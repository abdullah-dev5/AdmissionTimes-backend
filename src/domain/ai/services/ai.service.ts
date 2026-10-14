/**
 * AI admissions assistant.
 *
 * Flow (local-first, so the assistant keeps working without Gemini quota):
 *  1. Refuse sensitive requests.
 *  2. Rule-based intent detection (guidance / saved summary / search).
 *  3. Only unclassified messages go to Gemini for intent + filter extraction.
 *  4. Every search runs through one pipeline that queries the database with
 *     exact deadline windows, then relaxes filters, then falls back to the
 *     nearest upcoming deadlines.
 * Results always respect the caller's visibility rules (admissions service).
 */

import * as admissionsService from '@domain/admissions/services/admissions.service';
import { Admission } from '@domain/admissions/types/admissions.types';
import { query } from '@db/connection';
import { config } from '@config/config';
import { createLogger } from '@shared/utils/logger';
import { buildChatExtractionPrompt, buildGuidanceAnswerPrompt, buildSummarizationPrompt } from '../prompts/ai.prompts';
import {
  AdmissionChatFilters,
  AdmissionChatResponse,
  AdmissionChatResultItem,
  AdmissionSummaryResult,
  ChatExecutionContext,
  GeminiChatExtraction,
} from '../types/ai.types';
import { generateJson, generateText, getGeminiUsageMetadata, isGeminiConfigured, isGeminiQuotaError } from './gemini.client';
import { applySearchFirstPolicy, buildSearchFirstFilters, buildSearchRelaxationCandidates, buildSearchTermsFromMessage } from './admissionSearchFilters.service';

const log = createLogger('AI');

const MAX_RESULTS = 8;
const DEFAULT_UPCOMING_DEADLINE_DAYS = 30;
const WINDOW_ESCALATION_DAYS = [30, 90];
/** Admissions are published for Pakistan; calendar days are interpreted in PKT. */
const APP_UTC_OFFSET = process.env.APP_UTC_OFFSET || '+05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

const SENSITIVE_QUERY_PATTERN =
  /(password|passcode|credential|credentials|email list|all users|admin data|internal analytics|service role|token|refresh token|secret|api key|private key|otp|cnic|id card|identity number)/i;
const SENSITIVE_HISTORY_PATTERN =
  /(password|passcode|credential|secret|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|bearer\s+[a-z0-9._-]+|(?:cnic|id\s*card|identity number)\s*[:#-]?\s*\d)/i;

type Sort = 'created_at' | 'updated_at' | 'deadline' | 'title' | 'tuition_fee' | 'verified_at';
type Status = 'verified' | 'pending' | 'rejected' | 'draft';

interface SearchRequest {
  filters: AdmissionChatFilters;
  sort: Sort;
  order: 'asc' | 'desc';
  verificationStatus?: Status;
}

type LocalIntent =
  | { intent: 'guidance'; answer: string }
  | { intent: 'summarize_saved_admissions' }
  | ({ intent: 'search_admissions' } & SearchRequest)
  | { intent: 'unknown' };

type ConversationHistoryEntry = { role: 'user' | 'assistant' | 'ai'; text: string };

// ---------------------------------------------------------------------------
// Text normalization & parsing
// ---------------------------------------------------------------------------

const QUERY_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/\badm(?:ss|s|is|isis)i?on\b/gi, 'admission'],
  [/\badmsi\b/gi, 'admission'],
  [/\bdead(?:lne|lin|lien)\b/gi, 'deadline'],
  [/\buniver(?:isty|sitiy)\b/gi, 'university'],
  [/\bprogams?\b/gi, 'program'],
  [/\bths\b/gi, 'this'],
  [/\bmoonth\b/gi, 'month'],
  [/\bweelk\b/gi, 'week'],
];

const normalizeQueryText = (message: string): string => {
  let normalized = String(message || '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ');
  for (const [pattern, replacement] of QUERY_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
};

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
  july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9,
  november: 10, nov: 10, december: 11, dec: 11,
};
const MONTH_NAME_PATTERN = Object.keys(MONTH_MAP).sort((a, b) => b.length - a.length).join('|');

const resolveYear = (monthIndex: number, day: number, explicitYear?: number): number => {
  if (explicitYear && explicitYear >= 2000 && explicitYear <= 2100) return explicitYear;
  const now = new Date();
  const candidate = new Date(now.getFullYear(), monthIndex, day, 23, 59, 59);
  return candidate.getTime() < now.getTime() ? now.getFullYear() + 1 : now.getFullYear();
};

const toIsoDay = (year: number, monthIndex: number, day: number): string | undefined => {
  const probe = new Date(Date.UTC(year, monthIndex, day));
  if (probe.getUTCMonth() !== monthIndex || probe.getUTCDate() !== day) return undefined;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** Parse a specific calendar day ("26 June", "June 26 2026", "26/06"). Returns YYYY-MM-DD. */
const extractSpecificDate = (message: string): string | undefined => {
  const words = normalizeQueryText(message);

  const dayMonth = words.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAME_PATTERN})(?:\\s+(\\d{4}))?\\b`));
  if (dayMonth) {
    const day = Number(dayMonth[1]);
    const month = MONTH_MAP[dayMonth[2]];
    return toIsoDay(resolveYear(month, day, dayMonth[3] ? Number(dayMonth[3]) : undefined), month, day);
  }

  const monthDay = words.match(new RegExp(`\\b(${MONTH_NAME_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`));
  if (monthDay) {
    const month = MONTH_MAP[monthDay[1]];
    const day = Number(monthDay[2]);
    return toIsoDay(resolveYear(month, day, monthDay[3] ? Number(monthDay[3]) : undefined), month, day);
  }

  // Numeric dates need the raw text: normalization strips "/" and "-".
  const numeric = String(message || '').match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    let year = numeric[3] ? Number(numeric[3]) : resolveYear(month, day);
    if (year < 100) year += 2000;
    return toIsoDay(year, month, day);
  }

  const isoDay = String(message || '').match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoDay) return toIsoDay(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]));

  return undefined;
};

const daysUntilMonthEnd = (monthIndex: number): number => {
  const now = new Date();
  const year = monthIndex >= now.getMonth() ? now.getFullYear() : now.getFullYear() + 1;
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return Math.max(1, Math.ceil((monthEnd.getTime() - now.getTime()) / DAY_MS));
};

/** Parse a relative window ("within 10 days", "this week", "urgent", "in March"). */
const extractDeadlineWindowDays = (message: string): number | undefined => {
  const words = normalizeQueryText(message);

  const explicit = words.match(/(?:within|in|next)\s+(\d{1,3})\s+days?/) || words.match(/(\d{1,3})\s+days?\s+(?:left|remaining|away)/);
  if (explicit) {
    const days = Number(explicit[1]);
    if (days > 0) return days;
  }
  if (/\b(urgent|due soon|closing soon)\b/.test(words)) return 3;
  if (/\b(this|next|coming|within)\s+week\b/.test(words)) return 7;
  if (/\b(this|current)\s+month\b/.test(words)) return daysUntilMonthEnd(new Date().getMonth());

  const monthName = Object.keys(MONTH_MAP).find((name) => name.length > 3 && new RegExp(`\\b${name}\\b`).test(words));
  if (monthName) return daysUntilMonthEnd(MONTH_MAP[monthName]);

  if (/\bupcoming\b/.test(words)) return DEFAULT_UPCOMING_DEADLINE_DAYS;
  return undefined;
};

const extractSortPreference = (words: string): Pick<SearchRequest, 'sort' | 'order'> => {
  if (/(lowest fee|low fee|cheapest|cheap|affordable)/.test(words)) return { sort: 'tuition_fee', order: 'asc' };
  if (/(latest|newest|recent)/.test(words)) return { sort: 'created_at', order: 'desc' };
  return { sort: 'deadline', order: 'asc' };
};

const extractStatus = (message: string): Status | undefined => {
  const words = normalizeQueryText(message);
  if (/\bverified\b/.test(words)) return 'verified';
  if (/\b(pending|audit)\b/.test(words)) return 'pending';
  if (/\brejected\b/.test(words)) return 'rejected';
  if (/\bdrafts?\b/.test(words)) return 'draft';
  return undefined;
};

const normalizeDegreeLevel = (value?: string | null): string | undefined => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;
  if (['master', 'masters', 'ms', 'msc', 'mba', 'mphil', 'graduate', 'postgraduate'].includes(raw)) return 'master';
  if (['bachelor', 'bachelors', 'bs', 'bsc', 'be', 'bba', 'undergraduate'].includes(raw)) return 'bachelor';
  if (['phd', 'doctorate'].includes(raw)) return 'phd';
  if (raw === 'diploma') return 'diploma';
  return undefined;
};

const normalizeProgramType = (value?: string | null): string | undefined => {
  const raw = String(value || '').trim().toLowerCase();
  if (['graduate', 'postgraduate', 'pg'].includes(raw)) return 'graduate';
  if (['undergraduate', 'ug'].includes(raw)) return 'undergraduate';
  return undefined;
};

// ---------------------------------------------------------------------------
// Local intent detection
// ---------------------------------------------------------------------------

const DEGREE_OR_PROGRAM_HINT = /\b(bba|bs|bsc|be|ms|mba|mphil|phd|llb|llm|computer|engineering|business|data\s*science)\b/;
const ADMISSION_HINT = /\b(admission|admissions|announced|open\s+now|intake)\b/;
const DEADLINE_HINT = /\b(deadline|deadlines|urgent|closing|due\s+soon|this\s+week|next\s+week|upcoming)\b/;
const SAVED_HINT = /\b(saved|watchlist|bookmark|bookmarked|shortlist)\b/;
const SUMMARY_HINT = /\b(summar(y|ize|ise)|overview|recap)\b/;
const REVERIFICATION_HINT = /\bre\s?verification\b|\breverif/;

const UNIVERSITY_GUIDANCE: Array<{ test: RegExp; lines: string[] }> = [
  {
    test: /\b(pending|audit|status)\b/,
    lines: [
      'Pending Audit means the admission is waiting for admin verification.',
      '- Open Verification Center and review remarks for that admission.',
      '- Fix missing or invalid fields (title, deadline, eligibility, location).',
      '- Resubmit and monitor until status moves to Verified.',
    ],
  },
  {
    test: /\b(publish|upload|new admission)\b/,
    lines: [
      'Publishing checklist:',
      '- Open Manage Admissions and create a new admission.',
      '- Upload a PDF or fill the fields manually, then check the extracted details.',
      '- Submit for verification and track progress in Verification Center.',
    ],
  },
  {
    test: /\b(resubmit|edit)\b|re\s?verification|reverif/,
    lines: [
      'Editing a verified admission sends it back for re-verification.',
      '- While it is re-reviewed it is hidden from new students; students who saved it keep access and reminders.',
      '- Rejected admissions can be edited and resubmitted from Manage Admissions.',
      '- Check admin remarks before resubmitting.',
    ],
  },
];

const STUDENT_GUIDANCE: Array<{ test: RegExp; lines: string[] }> = [
  {
    test: /\bcompare\b/,
    lines: [
      'How to compare programs:',
      '- Open Compare and select two to four saved programs.',
      '- Review fee, deadline, location and eligibility side by side.',
      '- Keep the stronger option in your watchlist with alerts enabled.',
    ],
  },
  {
    test: /\b(alert|alerts|watchlist|reminder|reminders)\b/,
    lines: [
      'How deadline reminders work:',
      '- Save a program to your watchlist and switch its alert on.',
      '- You get reminders 7, 3 and 1 day before the deadline (in-app, plus email/push if enabled in Settings).',
      '- If a university extends a deadline, reminders restart for the new date.',
    ],
  },
  {
    test: /\b(status|verified|pending)\b/,
    lines: [
      'Status guide:',
      '- Verified: checked and approved by an AdmissionTimes admin.',
      '- Pending: being reviewed; saved programs stay visible to you during review.',
      '- Closed: the application deadline has passed.',
    ],
  },
];

const guidanceFor = (message: string, isUniversity: boolean): string => {
  const words = normalizeQueryText(message);
  const match = (isUniversity ? UNIVERSITY_GUIDANCE : STUDENT_GUIDANCE).find((entry) => entry.test.test(words));
  if (match) return match.lines.join('\n');
  return isUniversity
    ? ['I can help with your university workflow:', '- Publishing and submitting admissions', '- Verification status and fixes', '- Listing your admissions by status'].join('\n')
    : ['I can help you:', '- Find programs by field, city, degree and deadline', '- Compare saved programs', '- Explain statuses and reminders'].join('\n');
};

const buildSearchRequest = (message: string): SearchRequest => {
  const words = normalizeQueryText(message);
  const deadlineOn = extractSpecificDate(message);
  const windowDays = deadlineOn ? undefined : extractDeadlineWindowDays(message) ?? (DEADLINE_HINT.test(words) ? DEFAULT_UPCOMING_DEADLINE_DAYS : undefined);

  const filters = applySearchFirstPolicy(message, {
    ...buildSearchFirstFilters(message, { deadline_within_days: windowDays, deadline_on: deadlineOn }),
    field_of_study: undefined,
  });

  return { filters, ...extractSortPreference(words) };
};

const detectLocalIntent = (message: string, isUniversity: boolean): LocalIntent => {
  const words = normalizeQueryText(message);

  if (isUniversity) {
    if (REVERIFICATION_HINT.test(words) || /\b(publish|upload|verification|resubmit|policy|how do i|how to)\b/.test(words)) {
      return { intent: 'guidance', answer: guidanceFor(message, true) };
    }
    if (/\b(show|list|my|our)\b/.test(words) && /\b(admission|admissions|program|programs)\b/.test(words)) {
      return { intent: 'search_admissions', ...buildSearchRequest(message), verificationStatus: extractStatus(message) };
    }
    if (/\b(pending|audit|status)\b/.test(words)) {
      return { intent: 'guidance', answer: guidanceFor(message, true) };
    }
    return { intent: 'unknown' };
  }

  if (SAVED_HINT.test(words) && SUMMARY_HINT.test(words)) return { intent: 'summarize_saved_admissions' };
  if (/\bmy (saved|watchlist)\b/.test(words) && !DEADLINE_HINT.test(words)) return { intent: 'summarize_saved_admissions' };

  if (/\bhow (do|can) i\b/.test(words) || /\b(alerts?|reminders?|watchlist)\b/.test(words)) {
    return { intent: 'guidance', answer: guidanceFor(message, false) };
  }
  if (/\bcompare\b/.test(words) && !(DEGREE_OR_PROGRAM_HINT.test(words) || ADMISSION_HINT.test(words))) {
    return { intent: 'guidance', answer: guidanceFor(message, false) };
  }
  if (/\bwhat (does|is)\b.*\b(verified|pending|status)\b/.test(words)) {
    return { intent: 'guidance', answer: guidanceFor(message, false) };
  }
  if (DEADLINE_HINT.test(words) || DEGREE_OR_PROGRAM_HINT.test(words) || ADMISSION_HINT.test(words) || /\b(find|show|list|program|programs)\b/.test(words)) {
    return { intent: 'search_admissions', ...buildSearchRequest(message) };
  }

  return { intent: 'unknown' };
};

// ---------------------------------------------------------------------------
// Search pipeline (database-backed)
// ---------------------------------------------------------------------------

const dayBounds = (isoDay: string): { from: string; to: string } => ({
  from: `${isoDay}T00:00:00${APP_UTC_OFFSET}`,
  to: `${isoDay}T23:59:59.999${APP_UTC_OFFSET}`,
});

const toIso = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const mapResult = (admission: Admission): AdmissionChatResultItem => ({
  id: admission.id,
  title: admission.title,
  degree_level: admission.degree_level,
  location: admission.location,
  deadline: toIso(admission.deadline),
  verification_status: admission.verification_status,
  university_id: admission.university_id,
});

const findAdmissions = async (
  ctx: ChatExecutionContext,
  filters: AdmissionChatFilters & { deadline_from?: string; deadline_to?: string },
  options: { sort?: Sort; order?: 'asc' | 'desc'; status?: Status; limit?: number } = {}
): Promise<Admission[]> => {
  const { admissions } = await admissionsService.getMany(
    {
      search: filters.search,
      degree_level: filters.degree_level,
      field_of_study: filters.field_of_study,
      location: filters.location,
      program_type: filters.program_type,
      delivery_mode: filters.delivery_mode,
      deadline_from: filters.deadline_from,
      deadline_to: filters.deadline_to,
      verification_status: options.status,
      sort: options.sort || 'deadline',
      order: options.order || 'asc',
    },
    1,
    options.limit || MAX_RESULTS,
    ctx.userContext
  );
  return admissions;
};

interface SearchOutcome {
  results: AdmissionChatResultItem[];
  appliedFilters: AdmissionChatFilters;
  /** Set when the answer is a fallback rather than an exact match. */
  fallback?: 'nearest_to_date' | 'nearest_upcoming' | 'relaxed';
}

const runSearch = async (ctx: ChatExecutionContext, request: SearchRequest): Promise<SearchOutcome> => {
  const { filters, sort, order, verificationStatus } = request;
  const base = { ...filters, deadline_on: undefined, deadline_within_days: undefined };
  const now = new Date();

  // 1. A specific calendar day.
  if (filters.deadline_on) {
    const { from, to } = dayBounds(filters.deadline_on);
    const exact = await findAdmissions(ctx, { ...base, deadline_from: from, deadline_to: to }, { status: verificationStatus });
    if (exact.length) return { results: exact.map(mapResult), appliedFilters: filters };

    const target = new Date(from).getTime();
    const upcoming = await findAdmissions(ctx, { ...base, deadline_from: now.toISOString() }, { status: verificationStatus, limit: 40 });
    const nearest = upcoming
      .filter((item) => item.deadline)
      .sort((a, b) => Math.abs(new Date(a.deadline!).getTime() - target) - Math.abs(new Date(b.deadline!).getTime() - target))
      .slice(0, MAX_RESULTS);
    return { results: nearest.map(mapResult), appliedFilters: filters, fallback: 'nearest_to_date' };
  }

  // 2. A relative window, escalating to wider windows before giving up.
  if (filters.deadline_within_days) {
    const windows = Array.from(new Set([filters.deadline_within_days, ...WINDOW_ESCALATION_DAYS])).filter(
      (days) => days >= filters.deadline_within_days!
    );
    for (const days of windows) {
      const rows = await findAdmissions(
        ctx,
        { ...base, deadline_from: now.toISOString(), deadline_to: new Date(now.getTime() + days * DAY_MS).toISOString() },
        { sort: 'deadline', order: 'asc', status: verificationStatus }
      );
      if (rows.length) {
        return {
          results: rows.map(mapResult),
          appliedFilters: { ...filters, deadline_within_days: days },
          fallback: days !== filters.deadline_within_days ? 'nearest_upcoming' : undefined,
        };
      }
    }
    const upcoming = await findAdmissions(ctx, { ...base, deadline_from: now.toISOString() }, { status: verificationStatus });
    return { results: upcoming.map(mapResult), appliedFilters: filters, fallback: 'nearest_upcoming' };
  }

  // 3. Plain search, then progressively broader candidates.
  const direct = await findAdmissions(ctx, base, { sort, order, status: verificationStatus });
  if (direct.length) return { results: direct.map(mapResult), appliedFilters: filters };

  for (const candidate of buildSearchRelaxationCandidates({ ...base, field_of_study: undefined })) {
    const rows = await findAdmissions(ctx, candidate, { sort, order, status: verificationStatus });
    if (rows.length) return { results: rows.map(mapResult), appliedFilters: candidate, fallback: 'relaxed' };
  }

  if (filters.search) {
    const tokens = normalizeQueryText(filters.search)
      .split(' ')
      .filter((token) => token.length >= 3)
      .sort((a, b) => b.length - a.length)
      .slice(0, 3);
    for (const token of tokens) {
      const rows = await findAdmissions(ctx, { search: token }, { sort, order, status: verificationStatus });
      if (rows.length) return { results: rows.map(mapResult), appliedFilters: { search: token }, fallback: 'relaxed' };
    }
  }

  return { results: [], appliedFilters: filters };
};

// ---------------------------------------------------------------------------
// Answer formatting
// ---------------------------------------------------------------------------

const formatDateLabel = (value: string | null | undefined): string => {
  if (!value) return 'No deadline';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
};

const capitalize = (value?: string | null): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Unknown');

const formatLine = (item: AdmissionChatResultItem, index: number, isUniversity: boolean): string => {
  const details = [
    isUniversity ? `Status: ${capitalize(item.verification_status)}` : null,
    item.degree_level,
    item.location,
    item.deadline ? `Deadline: ${formatDateLabel(item.deadline)}` : null,
  ].filter(Boolean);
  return `${index + 1}) ${item.title}${details.length ? `\n   ${details.join(' | ')}` : ''}`;
};

const formatSearchAnswer = (outcome: SearchOutcome, request: SearchRequest, isUniversity: boolean): string => {
  const { results, appliedFilters, fallback } = outcome;
  const requested = request.filters;

  if (!results.length) {
    if (isUniversity) {
      const status = request.verificationStatus ? ` with status ${capitalize(request.verificationStatus)}` : '';
      return [`I could not find any of your admissions${status}.`, 'Try "Show my pending admissions" or open Manage Admissions.'].join('\n');
    }
    return [
      'I could not find a match for that search.',
      'Try: "Show BBA programs", "Deadlines this week" or "CS programs in Lahore".',
    ].join('\n');
  }

  let intro: string;
  if (fallback === 'nearest_to_date' && requested.deadline_on) {
    intro = `Nothing closes exactly on ${formatDateLabel(requested.deadline_on)}. Closest upcoming deadlines:`;
  } else if (requested.deadline_on) {
    intro = `Programs closing on ${formatDateLabel(requested.deadline_on)}:`;
  } else if (fallback === 'nearest_upcoming' && requested.deadline_within_days) {
    intro = `Nothing closes within ${requested.deadline_within_days} days. Nearest upcoming deadlines${
      appliedFilters.deadline_within_days ? ` (next ${appliedFilters.deadline_within_days} days)` : ''
    }:`;
  } else if (requested.deadline_within_days) {
    intro = `${results.length} program${results.length === 1 ? '' : 's'} with deadlines in the next ${requested.deadline_within_days} days:`;
  } else if (fallback === 'relaxed') {
    intro = 'No exact match, but these are closely related:';
  } else if (isUniversity) {
    intro = `Here are ${results.length} of your admission${results.length === 1 ? '' : 's'}:`;
  } else {
    intro = `I found ${results.length} matching program${results.length === 1 ? '' : 's'}:`;
  }

  return [intro, ...results.map((item, index) => formatLine(item, index, isUniversity))].join('\n');
};

// ---------------------------------------------------------------------------
// Saved admissions summary
// ---------------------------------------------------------------------------

const summarizeSavedAdmissions = async (ctx: ChatExecutionContext): Promise<{ answer: string; results: AdmissionChatResultItem[] }> => {
  const userId = ctx.userContext?.id;
  if (!userId) return { answer: 'Please sign in to get a summary of your saved programs.', results: [] };

  // Direct query: opening each saved admission through getById would record
  // dozens of fake "viewed" activities.
  const rows = await query(
    `SELECT a.id::text AS id, a.title, a.degree_level, a.location, a.deadline,
            a.verification_status, a.university_id::text AS university_id
     FROM watchlists w
     JOIN admissions a ON a.id = w.admission_id AND a.is_active = true
     WHERE w.user_id = $1
     ORDER BY a.deadline ASC NULLS LAST
     LIMIT 50`,
    [userId]
  );
  const results = (rows.rows as Admission[]).map(mapResult);

  if (!results.length) {
    return {
      answer: ['You have no saved programs yet.', '- Search programs and save them to your watchlist.', '- Turn on alerts to get deadline reminders.'].join('\n'),
      results,
    };
  }

  const nowMs = Date.now();
  const daysLeft = (item: AdmissionChatResultItem) => (item.deadline ? Math.ceil((new Date(item.deadline).getTime() - nowMs) / DAY_MS) : null);
  const upcoming = results.filter((item) => (daysLeft(item) ?? -1) >= 0);
  const urgent = upcoming.filter((item) => (daysLeft(item) as number) <= 3).length;
  const thisWeek = upcoming.filter((item) => (daysLeft(item) as number) <= 7).length;

  const lines = [
    `You have ${results.length} saved program${results.length === 1 ? '' : 's'}.`,
    `Closing in the next 3 days: ${urgent}`,
    `Closing this week: ${thisWeek}`,
  ];
  if (upcoming.length) {
    lines.push('Next deadlines:');
    upcoming.slice(0, 5).forEach((item, index) => lines.push(`${index + 1}. ${item.title} — ${formatDateLabel(item.deadline)} (${daysLeft(item)}d left)`));
  }
  const closed = results.length - upcoming.length;
  if (closed > 0) lines.push(`${closed} saved program${closed === 1 ? ' has' : 's have'} passed or no deadline; consider removing them.`);

  return { answer: lines.join('\n'), results: results.slice(0, 20) };
};

// ---------------------------------------------------------------------------
// Conversation context
// ---------------------------------------------------------------------------

const sanitizeConversationText = (value: string): string => {
  const text = value.trim();
  if (!text) return '';
  if (SENSITIVE_HISTORY_PATTERN.test(text)) return '[redacted sensitive content]';
  return text
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[redacted email]')
    .replace(/\b(?:bearer\s+)?[a-z0-9_-]{24,}\b/gi, '[redacted token]')
    .replace(/\b\d{13,}\b/g, '[redacted id]');
};

const buildConversationContext = (context?: string, history?: ConversationHistoryEntry[]): string | undefined => {
  const base = sanitizeConversationText(context || '');
  const lines = (history || [])
    .slice(-6)
    .map((entry) => {
      const text = sanitizeConversationText(String(entry.text || '')).slice(0, 200);
      return text ? `${entry.role === 'user' ? 'User' : 'Assistant'}: ${text}` : '';
    })
    .filter(Boolean);

  const merged = [base, lines.length ? 'Recent messages:' : '', ...lines].filter(Boolean).join('\n');
  return merged ? merged.slice(0, 3000) : undefined;
};

// ---------------------------------------------------------------------------
// Gemini-assisted path (only for messages local rules cannot classify)
// ---------------------------------------------------------------------------

const requestFromExtraction = (extraction: GeminiChatExtraction, message: string): SearchRequest => {
  const extractedDay = typeof extraction.deadline_on === 'string' ? extractSpecificDate(extraction.deadline_on) : undefined;
  const deadlineOn = extractSpecificDate(message) || extractedDay;
  const withinDays = Number(extraction.deadline_within_days);
  const rawSearch = typeof extraction.search === 'string' ? extraction.search.trim() : '';

  const filters = applySearchFirstPolicy(message, {
    search: rawSearch ? normalizeQueryText(rawSearch) : buildSearchTermsFromMessage(message),
    degree_level: normalizeDegreeLevel(extraction.degree_level || extraction.program_type),
    field_of_study: typeof extraction.field_of_study === 'string' ? extraction.field_of_study : undefined,
    location: typeof extraction.location === 'string' ? extraction.location : undefined,
    program_type: normalizeProgramType(extraction.program_type),
    delivery_mode: ['online', 'on-campus', 'hybrid'].includes(String(extraction.delivery_mode)) ? String(extraction.delivery_mode) : undefined,
    deadline_on: deadlineOn,
    deadline_within_days: !deadlineOn && Number.isFinite(withinDays) && withinDays > 0 ? Math.min(withinDays, 365) : undefined,
  });

  return { filters, ...extractSortPreference(normalizeQueryText(message)) };
};

const reply = (partial: Partial<AdmissionChatResponse> & Pick<AdmissionChatResponse, 'intent' | 'answer'>): AdmissionChatResponse => ({
  extracted_filters: {},
  clarification_needed: false,
  result_count: partial.results?.length ?? 0,
  results: [],
  ...partial,
});

const searchReply = async (ctx: ChatExecutionContext, request: SearchRequest, isUniversity: boolean): Promise<AdmissionChatResponse> => {
  const outcome = await runSearch(ctx, request);
  return reply({
    intent: 'search_admissions',
    extracted_filters: outcome.appliedFilters,
    answer: formatSearchAnswer(outcome, request, isUniversity),
    results: outcome.results,
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getAiHealth = () => {
  const metadata = getGeminiUsageMetadata();
  return { enabled: config.ai.enabled, provider: metadata.provider, model: metadata.model, ready: isGeminiConfigured() };
};

export const chatWithAdmissionsAssistant = async (
  message: string,
  conversationContext: string | undefined,
  conversationHistory: ConversationHistoryEntry[] | undefined,
  ctx: ChatExecutionContext
): Promise<AdmissionChatResponse> => {
  if (SENSITIVE_QUERY_PATTERN.test(message)) {
    return reply({
      intent: 'unsupported',
      answer: 'Sorry, I cannot help with personal or sensitive information. I can help with programs, eligibility and deadlines.',
    });
  }

  const role = ctx.userContext?.role || 'guest';
  const isUniversity = role === 'university';
  const local = detectLocalIntent(message, isUniversity);

  if (local.intent === 'guidance') return reply({ intent: 'guidance', answer: local.answer });

  if (local.intent === 'summarize_saved_admissions') {
    const summary = await summarizeSavedAdmissions(ctx);
    return reply({ intent: 'search_admissions', answer: summary.answer, results: summary.results });
  }

  if (local.intent === 'search_admissions') return searchReply(ctx, local, isUniversity);

  // Unclassified: ask Gemini, degrade gracefully when it is unavailable.
  if (!isGeminiConfigured()) {
    return reply({ intent: 'guidance', answer: guidanceFor(message, isUniversity) });
  }

  const context = buildConversationContext(conversationContext, conversationHistory);
  let extraction: GeminiChatExtraction;
  try {
    extraction = await generateJson<GeminiChatExtraction>({
      prompt: buildChatExtractionPrompt(message, context, role === 'maintenance' ? 'student' : role),
      temperature: 0.1,
    });
  } catch (error) {
    log.warn('Intent extraction failed; using local guidance', (error as Error)?.message);
    const prefix = isGeminiQuotaError(error) ? 'The AI assistant is busy right now. Here is some quick guidance:\n' : '';
    return reply({ intent: 'guidance', answer: prefix + guidanceFor(message, isUniversity) });
  }

  switch (extraction?.intent) {
    case 'search_admissions':
      return searchReply(ctx, { ...requestFromExtraction(extraction, message), verificationStatus: isUniversity ? extractStatus(message) : undefined }, isUniversity);

    case 'unsupported':
      return reply({
        intent: 'unsupported',
        answer:
          typeof extraction.refusal_reason === 'string' && extraction.refusal_reason.trim()
            ? extraction.refusal_reason.trim().slice(0, 300)
            : 'I can help with admissions, programs, deadlines and eligibility. Could you rephrase your question?',
      });

    case 'clarification': {
      const question =
        typeof extraction.clarification_question === 'string' && extraction.clarification_question.trim()
          ? extraction.clarification_question.trim().slice(0, 300)
          : 'Could you share more details about what you are looking for?';
      return reply({ intent: 'clarification', clarification_needed: true, clarification_question: question, answer: question });
    }

    default: {
      let answer: string;
      try {
        answer = (await generateText(buildGuidanceAnswerPrompt(message, context, isUniversity), 0.4)).trim().slice(0, 2000);
      } catch (error) {
        log.warn('Guidance generation failed; using local guidance', (error as Error)?.message);
        answer = guidanceFor(message, isUniversity);
      }
      return reply({ intent: 'guidance', answer });
    }
  }
};

export const summarizeAdmissionText = async (rawText: string): Promise<AdmissionSummaryResult> => {
  const extraction = await generateJson<Partial<AdmissionSummaryResult>>({
    prompt: buildSummarizationPrompt(rawText.slice(0, config.ai.maxInputChars)),
    temperature: 0.1,
  });

  const metadata = getGeminiUsageMetadata();
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
  const fee = Number(extraction.application_fee);

  return {
    title: str(extraction.title),
    degree_level: str(extraction.degree_level),
    location: str(extraction.location),
    application_fee: Number.isFinite(fee) && fee >= 0 ? fee : null,
    deadline: toIso(extraction.deadline),
    description: str(extraction.description),
    eligibility: str(extraction.eligibility),
    summary_text: str(extraction.summary_text) || 'No summary could be generated from the provided admission text.',
    highlights: Array.isArray(extraction.highlights) ? extraction.highlights.map(String).slice(0, 6) : [],
    extracted_fields: Array.isArray(extraction.extracted_fields) ? extraction.extracted_fields.map(String) : [],
    confidence: Number.isFinite(Number(extraction.confidence)) ? Math.max(0, Math.min(100, Number(extraction.confidence))) : 0,
    provider: metadata.provider,
    model: metadata.model,
    method: 'ai',
  };
};

export const summarizeAdmissionTextWithFallback = async (
  rawText: string,
  fallback: {
    title: string;
    degree_level: string;
    location: string;
    application_fee: number;
    deadline: string;
    description: string;
    extracted_fields: string[];
    confidence: number;
  }
): Promise<AdmissionSummaryResult> => {
  try {
    return await summarizeAdmissionText(rawText);
  } catch (error) {
    log.warn('PDF summary fell back to rule-based extraction', (error as Error)?.message);
    const summary = [
      `${fallback.title} is an admission listing${fallback.location ? ` in ${fallback.location}` : ''}.`,
      fallback.description ? fallback.description.slice(0, 240).trim() : '',
      fallback.deadline ? `Application deadline: ${fallback.deadline}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      title: fallback.title,
      degree_level: fallback.degree_level,
      location: fallback.location,
      application_fee: fallback.application_fee,
      deadline: fallback.deadline,
      description: fallback.description,
      eligibility: null,
      summary_text: summary,
      highlights: [],
      extracted_fields: fallback.extracted_fields,
      confidence: fallback.confidence,
      provider: 'regex',
      method: 'fallback',
    };
  }
};
