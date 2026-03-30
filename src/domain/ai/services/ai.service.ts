import * as admissionsService from '@domain/admissions/services/admissions.service';
import { Admission } from '@domain/admissions/types/admissions.types';
import * as watchlistsService from '@domain/watchlists/services/watchlists.service';
import { AppError } from '@shared/middleware/errorHandler';
import { config } from '@config/config';
import { buildChatExtractionPrompt, buildGuidanceAnswerPrompt, buildSummarizationPrompt, isUniversityContext } from '../prompts/ai.prompts';
import {
  AdmissionChatFilters,
  AdmissionChatResponse,
  AdmissionChatResultItem,
  AdmissionSummaryResult,
  ChatExecutionContext,
  GeminiChatExtraction,
} from '../types/ai.types';
import { generateJson, generateText, getGeminiUsageMetadata, isGeminiConfigured } from './gemini.client';

const MAX_RESULTS = 8;
const SENSITIVE_QUERY_PATTERN = /(password|passcode|credential|credentials|email list|all users|admin data|internal analytics|service role|token|refresh token|secret|api key|private key|otp|cnic|id card|identity number)/i;
const STOP_WORDS = new Set([
  'is', 'any', 'the', 'a', 'an', 'for', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'with', 'this', 'that',
  'show', 'find', 'program', 'programs', 'admission', 'admissions', 'announced', 'please', 'me', 'my', 'all',
]);
const SEARCH_NOISE_WORDS = new Set([
  'show', 'find', 'list', 'any', 'open', 'latest', 'urgent', 'deadline', 'deadlines', 'admission', 'admissions',
  'admssion', 'showany', 'please', 'me', 'my', 'all', 'in', 'with', 'for', 'the', 'this', 'week', 'month',
]);

type LocalIntentResult = {
  intent: 'guidance' | 'search_admissions' | 'summarize_saved_admissions' | 'unknown';
  answer?: string;
  filters?: AdmissionChatFilters;
  verification_status?: 'verified' | 'pending' | 'rejected';
  sort?: 'created_at' | 'updated_at' | 'deadline' | 'title' | 'tuition_fee' | 'verified_at';
  order?: 'asc' | 'desc';
};

type ConversationHistoryEntry = {
  role: 'user' | 'assistant' | 'ai';
  text: string;
};

const DEGREE_OR_PROGRAM_HINT = /\b(bba|bs|bsc|be|ms|mba|mphil|phd|llb|llm|computer|engineering|business|data\s*science)\b/i;
const ADMISSION_HINT = /(admission|admissions|admis|admsi|admssion|announced|open\s+now|intake)/i;
const DEADLINE_HINT = /(deadline|deadlines|urgent|closing|this\s+week|within\s+week|next\s+week|due\s+soon)/i;
const SAVED_SUMMARY_HINT = /(saved|watchlist|bookmark|bookmarked|shortlist)/i;
const SUMMARY_HINT = /(summar(y|ize|ise)|overview|recap)/i;
const CITY_HINTS = ['lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar', 'quetta', 'sialkot'];
const MONTH_MAP: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const isGeminiQuotaError = (error: unknown): boolean => {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('resource_exhausted') ||
    message.includes('quota') ||
    message.includes('rate-limit')
  );
};

const toTitleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const extractLocationFromMessage = (lowerMessage: string): string | undefined => {
  const city = CITY_HINTS.find((candidate) => lowerMessage.includes(candidate));
  return city ? toTitleCase(city) : undefined;
};

const extractProgramTypeFromMessage = (message: string): string | undefined => {
  const lower = message.toLowerCase();
  if (/\b(undergraduate|ug)\b/i.test(lower)) {
    return 'undergraduate';
  }
  if (/\b(graduate|postgraduate|pg)\b/i.test(lower)) {
    return 'graduate';
  }
  return undefined;
};

const extractFieldOfStudyFromMessage = (lowerMessage: string): string | undefined => {
  if (/(computer\s*science|\bcs\b|software|artificial intelligence|ai)/i.test(lowerMessage)) {
    return 'Computer Science';
  }
  if (/(business|bba|mba|finance|accounting)/i.test(lowerMessage)) {
    return 'Business';
  }
  if (/(electrical|electronics|ee)/i.test(lowerMessage)) {
    return 'Electrical Engineering';
  }
  if (/(mechanical|mechatronics)/i.test(lowerMessage)) {
    return 'Mechanical Engineering';
  }
  if (/(data\s*science|analytics)/i.test(lowerMessage)) {
    return 'Data Science';
  }
  if (/(economics|economic)/i.test(lowerMessage)) {
    return 'Economics';
  }
  return undefined;
};

const extractDegreeLevelFromMessage = (lowerMessage: string): string | undefined => {
  if (/\b(ms|msc|mba|mphil|master|masters|postgraduate|graduate)\b/i.test(lowerMessage)) {
    return 'master';
  }
  if (/\b(bs|bsc|be|bba|llb|bachelor|undergraduate)\b/i.test(lowerMessage)) {
    return 'bachelor';
  }
  if (/\b(phd|doctorate)\b/i.test(lowerMessage)) {
    return 'phd';
  }
  if (/\b(diploma)\b/i.test(lowerMessage)) {
    return 'diploma';
  }
  return undefined;
};

const normalizeDegreeLevel = (value: string | null | undefined): string | undefined => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;
  if (['master', 'masters', 'ms', 'msc', 'mba', 'mphil', 'graduate', 'postgraduate'].includes(raw)) return 'master';
  if (['bachelor', 'bachelors', 'bs', 'bsc', 'be', 'bba', 'undergraduate'].includes(raw)) return 'bachelor';
  if (['phd', 'doctorate'].includes(raw)) return 'phd';
  if (['diploma'].includes(raw)) return 'diploma';
  return value || undefined;
};

const normalizeProgramType = (value: string | null | undefined): string | undefined => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return undefined;
  if (['graduate', 'postgraduate', 'pg'].includes(raw)) return 'graduate';
  if (['undergraduate', 'ug'].includes(raw)) return 'undergraduate';
  return undefined;
};

const deriveSearchKeyword = (message: string): string | undefined => {
  const tokens = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !SEARCH_NOISE_WORDS.has(token))
    .filter((token) => token.length >= 3);

  const unique = Array.from(new Set(tokens)).slice(0, 4);
  return unique.length > 0 ? unique.join(' ') : undefined;
};

const shouldUseRawSearch = (
  message: string,
  lowerMessage: string,
  structuredFilterCount: number
): boolean => {
  const derived = deriveSearchKeyword(message);
  if (!derived) return false;

  if (structuredFilterCount > 0 && !DEADLINE_HINT.test(lowerMessage)) {
    return true;
  }

  const tokens = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length >= 3 && !SEARCH_NOISE_WORDS.has(token));

  // Keep search for meaningful free-text queries only.
  return tokens.length > 0 && !DEADLINE_HINT.test(lowerMessage);
};

const daysUntilMonthEnd = (monthIndex: number): number | undefined => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const candidateYear = monthIndex >= now.getMonth() ? currentYear : currentYear + 1;
  const monthEnd = new Date(candidateYear, monthIndex + 1, 0, 23, 59, 59, 999);
  const diffMs = monthEnd.getTime() - now.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return undefined;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};

const extractDeadlineWithinDaysFromMessage = (lowerMessage: string): number | undefined => {
  if (lowerMessage.includes('urgent') || lowerMessage.includes('due soon')) {
    return 3;
  }

  if (lowerMessage.includes('this week') || lowerMessage.includes('within week') || lowerMessage.includes('next week')) {
    return 7;
  }

  if (lowerMessage.includes('this month') || lowerMessage.includes('closing this month')) {
    const now = new Date();
    return daysUntilMonthEnd(now.getMonth());
  }

  const monthName = Object.keys(MONTH_MAP).find((month) => lowerMessage.includes(month));
  if (monthName) {
    return daysUntilMonthEnd(MONTH_MAP[monthName]);
  }

  return undefined;
};

const extractSortPreference = (
  lowerMessage: string
): Pick<LocalIntentResult, 'sort' | 'order'> => {
  if (/(lowest fee|low fee|cheapest|cheap)/i.test(lowerMessage)) {
    return { sort: 'tuition_fee', order: 'asc' };
  }

  if (/(latest|newest|recent)/i.test(lowerMessage)) {
    return { sort: 'created_at', order: 'desc' };
  }

  if (/(nearest deadline|closing soon|deadline)/i.test(lowerMessage)) {
    return { sort: 'deadline', order: 'asc' };
  }

  return { sort: 'deadline', order: 'asc' };
};

const buildLocalSearchFilters = (message: string, lowerMessage: string): AdmissionChatFilters => {
  const deadlineWithinDays = extractDeadlineWithinDaysFromMessage(lowerMessage);
  const degreeLevel = extractDegreeLevelFromMessage(lowerMessage);
  const fieldOfStudy = extractFieldOfStudyFromMessage(lowerMessage);
  const location = extractLocationFromMessage(lowerMessage);
  const programType = extractProgramTypeFromMessage(message);
  const deliveryMode = lowerMessage.includes('evening') ? 'on-campus' : undefined;

  const structuredFilterCount = [
    degreeLevel,
    fieldOfStudy,
    location,
    programType,
    deliveryMode,
    deadlineWithinDays,
  ].filter((value) => value !== undefined && value !== null).length;

  return {
    search: shouldUseRawSearch(message, lowerMessage, structuredFilterCount) ? deriveSearchKeyword(message) : undefined,
    degree_level: degreeLevel,
    field_of_study: fieldOfStudy,
    location,
    program_type: programType,
    delivery_mode: deliveryMode,
    deadline_within_days: deadlineWithinDays,
  };
};

const buildLocalGuidance = (message: string, isUniversity: boolean): string => {
  const lower = message.toLowerCase();

  if (isUniversity) {
    if (lower.includes('pending') || lower.includes('audit') || lower.includes('status')) {
      return [
        'Pending Audit means the admission is waiting for admin verification.',
        '- Open Verification Center and review remarks for that admission.',
        '- Fix missing or invalid fields (title, deadline, eligibility, location).',
        '- Resubmit and monitor until status moves to Verified.',
      ].join('\n');
    }

    if (lower.includes('publish') || lower.includes('upload') || lower.includes('new admission')) {
      return [
        'Publishing checklist:',
        '- Open Manage Admissions and create a new admission.',
        '- Upload PDF or fill fields manually and verify extracted details.',
        '- Submit for verification and track progress in Verification Center.',
      ].join('\n');
    }

    if (lower.includes('re-verification') || lower.includes('resubmit') || lower.includes('edit')) {
      return [
        'Re-verification is triggered when key admission details are edited.',
        '- Update fields carefully and keep deadline/eligibility consistent.',
        '- Resubmit and check verification remarks for corrections.',
      ].join('\n');
    }

    return [
      'I can help with university admission workflow:',
      '- Publishing and submitting admissions',
      '- Verification status explanation and fixes',
      '- Resubmission and data quality checklist',
    ].join('\n');
  }

  if (lower.includes('compare')) {
    return [
      'How to compare programs:',
      '- Open Compare and select at least two saved programs.',
      '- Review fee, deadline, location, and eligibility side by side.',
      '- Keep the stronger option in watchlist with alerts enabled.',
    ].join('\n');
  }

  if (lower.includes('alert') || lower.includes('watchlist') || lower.includes('reminder')) {
    return [
      'How to manage alerts:',
      '- Open Watchlist and enable reminders for your saved programs.',
      '- Check Deadlines for urgent items this week.',
      '- Remove expired entries to keep your list relevant.',
    ].join('\n');
  }

  if (lower.includes('deadline') || lower.includes('urgent') || lower.includes('this week') || lower.includes('closing')) {
    return [
      'For urgent deadlines this week:',
      '- Open Deadlines and sort by nearest date first.',
      '- Enable watchlist alerts to get reminders before due dates.',
      '- Use Search with a degree/program keyword to narrow active options.',
    ].join('\n');
  }

  if (lower.includes('status') || lower.includes('application')) {
    return [
      'Status quick guide:',
      '- Verified: listing is approved and visible.',
      '- Pending: still under review.',
      '- Rejected: check remarks and required corrections.',
    ].join('\n');
  }

  return [
    'I can help with admissions tasks:',
    '- Find programs by field, city, degree, and deadline',
    '- Compare options and explain differences',
    '- Explain statuses and suggest next actions',
  ].join('\n');
};

const buildRelaxedSearchQueries = (search: string): string[] => {
  const raw = String(search || '').toLowerCase();
  if (!raw.trim()) return [];

  const tokens = raw
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  const uniqueTokens = Array.from(new Set(tokens));
  const prioritized = uniqueTokens
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);

  return prioritized;
};

const tryRelaxedSearch = async (
  filters: AdmissionChatFilters,
  executionContext: ChatExecutionContext
): Promise<AdmissionChatResultItem[]> => {
  if (!filters.search) {
    return [];
  }

  const candidates = buildRelaxedSearchQueries(filters.search);
  for (const candidate of candidates) {
    const { admissions } = await admissionsService.getMany(
      {
        search: candidate,
        degree_level: filters.degree_level,
        field_of_study: filters.field_of_study,
        location: filters.location,
        program_type: filters.program_type,
        delivery_mode: filters.delivery_mode,
      },
      1,
      MAX_RESULTS,
      'deadline',
      'asc',
      executionContext.userContext
    );

    const filteredAdmissions = filterByDeadlineWindow(admissions, filters.deadline_within_days);
    const results = filteredAdmissions.slice(0, MAX_RESULTS).map(mapResult);
    if (results.length > 0) {
      return results;
    }
  }

  return [];
};

const pickDefinedFilters = (filters: AdmissionChatFilters): AdmissionChatFilters => {
  const clean: AdmissionChatFilters = {};
  if (filters.search) clean.search = filters.search;
  if (filters.degree_level) clean.degree_level = filters.degree_level;
  if (filters.field_of_study) clean.field_of_study = filters.field_of_study;
  if (filters.location) clean.location = filters.location;
  if (filters.program_type) clean.program_type = filters.program_type;
  if (filters.delivery_mode) clean.delivery_mode = filters.delivery_mode;
  if (filters.deadline_within_days) clean.deadline_within_days = filters.deadline_within_days;
  return clean;
};

const buildRelaxationCandidates = (filters: AdmissionChatFilters): AdmissionChatFilters[] => {
  const base = pickDefinedFilters(filters);
  const candidates: AdmissionChatFilters[] = [base];

  if (base.program_type) {
    const { program_type, ...rest } = base;
    candidates.push(rest);
  }

  if (base.degree_level) {
    const { degree_level, ...rest } = base;
    candidates.push(rest);
  }

  if (base.degree_level || base.program_type) {
    const { degree_level, program_type, ...rest } = base;
    candidates.push(rest);
  }

  if (base.search) {
    candidates.push({ search: base.search, deadline_within_days: base.deadline_within_days });
  }

  if (base.field_of_study) {
    candidates.push({
      field_of_study: base.field_of_study,
      location: base.location,
      deadline_within_days: base.deadline_within_days,
    });
  }

  if (base.location) {
    candidates.push({ location: base.location, deadline_within_days: base.deadline_within_days });
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const tryRelaxedFilterSearch = async (
  filters: AdmissionChatFilters,
  executionContext: ChatExecutionContext,
  sort: LocalIntentResult['sort'] = 'deadline',
  order: LocalIntentResult['order'] = 'asc'
): Promise<AdmissionChatResultItem[]> => {
  const candidates = buildRelaxationCandidates(filters);

  for (const candidate of candidates) {
    const { admissions } = await admissionsService.getMany(
      {
        search: candidate.search,
        degree_level: candidate.degree_level,
        field_of_study: candidate.field_of_study,
        location: candidate.location,
        program_type: candidate.program_type,
        delivery_mode: candidate.delivery_mode,
      },
      1,
      MAX_RESULTS * 2,
      sort || 'deadline',
      order || 'asc',
      executionContext.userContext
    );

    const filteredAdmissions = filterByDeadlineWindow(admissions, candidate.deadline_within_days);
    const results = filteredAdmissions.slice(0, MAX_RESULTS).map(mapResult);
    if (results.length > 0) {
      return results;
    }
  }

  return [];
};

const detectLocalIntent = (message: string, isUniversity: boolean): LocalIntentResult => {
  const lower = message.toLowerCase();

  if (isUniversity) {
    if (
      lower.includes('publish') ||
      lower.includes('upload') ||
      lower.includes('pending audit') ||
      lower.includes('verification') ||
      lower.includes('re-verification') ||
      lower.includes('resubmit') ||
      lower.includes('policy') ||
      lower.includes('status')
    ) {
      return { intent: 'guidance', answer: buildLocalGuidance(message, true) };
    }

    if (lower.includes('show') || lower.includes('list') || lower.includes('all my') || lower.includes('my ')) {
      const filters: AdmissionChatFilters = {};
      let verificationStatus: LocalIntentResult['verification_status'];

      if (lower.includes('verified')) verificationStatus = 'verified';
      if (lower.includes('pending')) verificationStatus = 'pending';
      if (lower.includes('rejected')) verificationStatus = 'rejected';

      return { intent: 'search_admissions', filters, verification_status: verificationStatus };
    }
  } else {
    if (SAVED_SUMMARY_HINT.test(lower) && SUMMARY_HINT.test(lower)) {
      return { intent: 'summarize_saved_admissions' };
    }

    if (lower.includes('my saved admissions') || lower.includes('my watchlist') || lower.includes('saved programs summary')) {
      return { intent: 'summarize_saved_admissions' };
    }

    if (
      lower.includes('how do i') ||
      lower.includes('watchlist') ||
      lower.includes('alerts') ||
      lower.includes('status')
    ) {
      return { intent: 'guidance', answer: buildLocalGuidance(message, false) };
    }

    if (lower.includes('compare') && !(DEGREE_OR_PROGRAM_HINT.test(lower) || ADMISSION_HINT.test(lower))) {
      return { intent: 'guidance', answer: buildLocalGuidance(message, false) };
    }

    if (DEADLINE_HINT.test(lower)) {
      const withinDays = extractDeadlineWithinDaysFromMessage(lower) || (lower.includes('urgent') ? 3 : 7);
      const filters = buildLocalSearchFilters(message, lower);
      return {
        intent: 'search_admissions',
        filters: {
          ...filters,
          deadline_within_days: withinDays,
        },
        ...extractSortPreference(lower),
      };
    }

    if (
      lower.includes('find') ||
      lower.includes('show') ||
      lower.includes('admission') ||
      lower.includes('program')
    ) {
      return {
        intent: 'search_admissions',
        filters: buildLocalSearchFilters(message, lower),
        ...extractSortPreference(lower),
      };
    }

    if (DEGREE_OR_PROGRAM_HINT.test(lower) || ADMISSION_HINT.test(lower)) {
      return {
        intent: 'search_admissions',
        filters: buildLocalSearchFilters(message, lower),
        ...extractSortPreference(lower),
      };
    }
  }

  return { intent: 'unknown' };
};

const normalizeFilters = (extraction: GeminiChatExtraction): AdmissionChatFilters => {
  const deadlineWithinDays = extraction.deadline_within_days ?? undefined;
  const normalizedProgramType = normalizeProgramType(extraction.program_type);
  const normalizedDegreeLevel = normalizeDegreeLevel(extraction.degree_level || extraction.program_type);
  const normalizedSearch = extraction.search ? deriveSearchKeyword(extraction.search) || extraction.search : undefined;

  return {
    search: normalizedSearch,
    degree_level: normalizedDegreeLevel,
    field_of_study: extraction.field_of_study || undefined,
    location: extraction.location || undefined,
    program_type: normalizedProgramType,
    delivery_mode: extraction.delivery_mode || undefined,
    deadline_within_days: typeof deadlineWithinDays === 'number' && deadlineWithinDays > 0 ? deadlineWithinDays : undefined,
  };
};

const mapResult = (admission: Admission): AdmissionChatResultItem => ({
  id: admission.id,
  title: admission.title,
  degree_level: admission.degree_level,
  location: admission.location,
  deadline: admission.deadline,
  verification_status: admission.verification_status,
  university_id: admission.university_id,
});

const filterByDeadlineWindow = (admissions: Admission[], withinDays?: number): Admission[] => {
  if (!withinDays) {
    return admissions;
  }

  const now = Date.now();
  const windowMs = withinDays * 24 * 60 * 60 * 1000;

  return admissions.filter((admission) => {
    if (!admission.deadline) {
      return false;
    }

    const deadlineMs = new Date(admission.deadline).getTime();
    return Number.isFinite(deadlineMs) && deadlineMs >= now && deadlineMs - now <= windowMs;
  });
};

const formatAdmissionLine = (admission: AdmissionChatResultItem, index: number): string => {
  const detailParts = [admission.degree_level, admission.location, admission.deadline].filter(Boolean);
  return `${index + 1}) ${admission.title}${detailParts.length > 0 ? `\n   ${detailParts.join(' | ')}` : ''}`;
};

const formatSearchAnswer = (results: AdmissionChatResultItem[], filters: AdmissionChatFilters): string => {
  if (results.length === 0) {
    const quickSuggestions = [
      '- "Show BBA programs"',
      '- "Show deadlines this week"',
      '- "Show verified programs in Lahore"',
      '- "Compare saved programs"',
    ];

    return [
      'I could not find an exact match for that search.',
      'You can try one of these next:',
      ...quickSuggestions,
      'If you want, I can also broaden the search by city, degree, or deadline window.',
    ].join('\n');
  }

  const appliedFilters = [filters.search, filters.degree_level, filters.field_of_study, filters.location]
    .filter(Boolean)
    .join(', ');

  const intro = filters.deadline_within_days
    ? `I found ${results.length} match${results.length === 1 ? '' : 'es'} with deadlines in the next ${filters.deadline_within_days} days:`
    : appliedFilters
    ? `I found ${results.length} match${results.length === 1 ? '' : 'es'} for: ${appliedFilters}.`
    : `I found ${results.length} relevant admission${results.length === 1 ? '' : 's'}:`;

  return [
    intro,
    ...results.map(formatAdmissionLine),
    'Tell me if you want these sorted by nearest deadline or lowest fee.',
  ].join('\n');
};

const formatDeadlineFallbackAnswer = (
  strictWithinDays: number,
  fallbackResults: AdmissionChatResultItem[]
): string => {
  if (fallbackResults.length === 0) {
    return [
      `I could not find admissions with deadlines within ${strictWithinDays} days.`,
      'Try widening the range, for example: "Show deadlines this month".',
    ].join('\n');
  }

  return [
    `I could not find admissions within ${strictWithinDays} days.`,
    'Here are the nearest upcoming deadlines instead:',
    ...fallbackResults.map(formatAdmissionLine),
    'If you want, I can narrow this to a specific city or degree level.',
  ].join('\n');
};

const formatDateLabel = (value: string | null | undefined): string => {
  if (!value) return 'No deadline';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getDaysUntil = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const now = Date.now();
  const deadlineMs = new Date(value).getTime();
  if (!Number.isFinite(deadlineMs)) return null;
  return Math.ceil((deadlineMs - now) / (24 * 60 * 60 * 1000));
};

const buildSavedAdmissionsSummaryAnswer = (results: AdmissionChatResultItem[]): string => {
  if (results.length === 0) {
    return [
      'You do not have any active saved admissions right now.',
      'Try these next steps:',
      '- Search admissions and save programs to your watchlist.',
      '- Enable watchlist alerts so urgent deadlines are easier to track.',
    ].join('\n');
  }

  const withDeadlines = results
    .map((item) => ({ item, days: getDaysUntil(item.deadline) }))
    .filter((entry) => entry.days !== null)
    .sort((a, b) => (a.days as number) - (b.days as number));

  const urgentCount = withDeadlines.filter((entry) => (entry.days as number) >= 0 && (entry.days as number) <= 3).length;
  const weekCount = withDeadlines.filter((entry) => (entry.days as number) >= 0 && (entry.days as number) <= 7).length;

  const topUpcoming = withDeadlines.slice(0, 5).map((entry, index) => {
    const daysLabel = (entry.days as number) < 0 ? 'passed' : `${entry.days}d left`;
    return `${index + 1}. ${entry.item.title} — ${formatDateLabel(entry.item.deadline)} (${daysLabel})`;
  });

  const lines = [
    `You currently have ${results.length} saved admission${results.length === 1 ? '' : 's'}.`,
    `Urgent deadlines (next 3 days): ${urgentCount}`,
    `Deadlines this week (next 7 days): ${weekCount}`,
  ];

  if (topUpcoming.length > 0) {
    lines.push('Top upcoming saved admissions:');
    lines.push(...topUpcoming);
  }

  lines.push('Recommended next steps:');
  lines.push('- Prioritize programs with nearest deadlines first.');
  lines.push('- Keep alerts enabled for high-priority saved admissions.');

  return lines.join('\n');
};

const summarizeSavedAdmissions = async (
  executionContext: ChatExecutionContext
): Promise<{ answer: string; results: AdmissionChatResultItem[] }> => {
  const userContext = executionContext.userContext;
  if (!userContext?.id) {
    return {
      answer: 'Please sign in to get a summary of your saved admissions.',
      results: [],
    };
  }

  const { watchlists } = await watchlistsService.getWatchlists(
    {
      user_id: userContext.id,
      page: 1,
      limit: 50,
      sort: 'created_at',
      order: 'desc',
    },
    userContext
  );

  if (!watchlists.length) {
    return {
      answer: buildSavedAdmissionsSummaryAnswer([]),
      results: [],
    };
  }

  const settled = await Promise.allSettled(
    watchlists.map(async (item) => admissionsService.getById(item.admission_id, userContext))
  );

  const admissions = settled
    .filter((entry): entry is PromiseFulfilledResult<Admission> => entry.status === 'fulfilled')
    .map((entry) => entry.value);

  const results = admissions.slice(0, 20).map(mapResult);
  return {
    answer: buildSavedAdmissionsSummaryAnswer(results),
    results,
  };
};

const buildSummaryTextFromFallback = (description: string | null | undefined, title: string, location: string, deadline: string): string => {
  const summaryParts = [
    `${title} is an admission listing${location ? ` in ${location}` : ''}.`,
    description ? description.slice(0, 240).trim() : '',
    deadline ? `Application deadline: ${deadline}.` : '',
  ].filter(Boolean);

  return summaryParts.join(' ');
};

const buildConversationContext = (
  conversationContext: string | undefined,
  conversationHistory: ConversationHistoryEntry[] | undefined
): string | undefined => {
  const base = conversationContext?.trim() || '';
  const history = Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];

  if (history.length === 0) {
    return base || undefined;
  }

  const historyLines = history
    .map((entry) => {
      const role = entry.role === 'user' ? 'User' : 'Assistant';
      const text = String(entry.text || '').trim().slice(0, 200);
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean);

  if (historyLines.length === 0) {
    return base || undefined;
  }

  const merged = [base, 'Recent messages:', ...historyLines].filter(Boolean).join('\n');
  return merged.slice(0, 3000);
};

export const getAiHealth = () => {
  const metadata = getGeminiUsageMetadata();
  return {
    enabled: config.ai.enabled,
    provider: metadata.provider,
    model: metadata.model,
    ready: isGeminiConfigured(),
  };
};

export const summarizeAdmissionText = async (rawText: string): Promise<AdmissionSummaryResult> => {
  const boundedText = rawText.slice(0, config.ai.maxInputChars);

  if (!isGeminiConfigured()) {
    throw new AppError('Gemini AI is not configured', 503);
  }

  const extraction = await generateJson<Omit<AdmissionSummaryResult, 'provider' | 'method' | 'model'>>({
    prompt: buildSummarizationPrompt(boundedText),
    temperature: 0.1,
  });

  const metadata = getGeminiUsageMetadata();
  return {
    ...extraction,
    summary_text: extraction.summary_text?.trim() || 'No summary could be generated from the provided admission text.',
    highlights: Array.isArray(extraction.highlights) ? extraction.highlights.slice(0, 6) : [],
    extracted_fields: Array.isArray(extraction.extracted_fields) ? extraction.extracted_fields : [],
    confidence: typeof extraction.confidence === 'number' ? Math.max(0, Math.min(100, extraction.confidence)) : 0,
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
  } catch {
    return {
      title: fallback.title,
      degree_level: fallback.degree_level,
      location: fallback.location,
      application_fee: fallback.application_fee,
      deadline: fallback.deadline,
      description: fallback.description,
      eligibility: null,
      summary_text: buildSummaryTextFromFallback(
        fallback.description,
        fallback.title,
        fallback.location,
        fallback.deadline
      ),
      highlights: [],
      extracted_fields: fallback.extracted_fields,
      confidence: fallback.confidence,
      provider: 'regex',
      method: 'fallback',
    };
  }
};

export const chatWithAdmissionsAssistant = async (
  message: string,
  conversationContext: string | undefined,
  conversationHistory: ConversationHistoryEntry[] | undefined,
  executionContext: ChatExecutionContext
): Promise<AdmissionChatResponse> => {
  if (!isGeminiConfigured()) {
    throw new AppError('Gemini AI is not configured', 503);
  }

  if (SENSITIVE_QUERY_PATTERN.test(message)) {
    return {
      intent: 'unsupported',
      extracted_filters: {},
      clarification_needed: false,
      answer: 'Sorry, I cannot access personal or sensitive information. I can only help with university admissions, programs, eligibility, and deadlines.',
      result_count: 0,
      results: [],
    };
  }

  const enrichedContext = buildConversationContext(conversationContext, conversationHistory);
  const uniCtx = isUniversityContext(enrichedContext);
  const localIntent = detectLocalIntent(message, uniCtx);

  if (localIntent.intent === 'guidance' && localIntent.answer) {
    return {
      intent: 'guidance',
      extracted_filters: {},
      clarification_needed: false,
      answer: localIntent.answer,
      result_count: 0,
      results: [],
    };
  }

  // Step 1: classify intent and extract filters (JSON, low temperature)
  let extraction: GeminiChatExtraction;
  try {
    extraction = await generateJson<GeminiChatExtraction>({
      prompt: buildChatExtractionPrompt(message, enrichedContext),
      temperature: 0.1,
    });
  } catch (error) {
    if (isGeminiQuotaError(error)) {
      return {
        intent: 'guidance',
        extracted_filters: {},
        clarification_needed: false,
        answer: [
          'AI quota is temporarily exhausted. You can still continue with this guidance:',
          buildLocalGuidance(message, uniCtx),
        ].join('\n'),
        result_count: 0,
        results: [],
      };
    }

    extraction = { intent: 'guidance' };
  }

  const filters = normalizeFilters(extraction);

  if (localIntent.intent === 'search_admissions') {
    const { admissions } = await admissionsService.getMany(
      {
        search: localIntent.filters?.search,
        degree_level: localIntent.filters?.degree_level,
        field_of_study: localIntent.filters?.field_of_study,
        location: localIntent.filters?.location,
        program_type: localIntent.filters?.program_type,
        delivery_mode: localIntent.filters?.delivery_mode,
        verification_status: localIntent.verification_status,
      },
      1,
      MAX_RESULTS * 2,
      localIntent.sort || 'deadline',
      localIntent.order || 'asc',
      executionContext.userContext
    );

    const filteredAdmissions = filterByDeadlineWindow(admissions, localIntent.filters?.deadline_within_days);
    let results = (localIntent.filters?.deadline_within_days ? filteredAdmissions : admissions)
      .slice(0, MAX_RESULTS)
      .map(mapResult);
    if (results.length === 0) {
      const relaxedResults = await tryRelaxedFilterSearch(
        localIntent.filters || {},
        executionContext,
        localIntent.sort,
        localIntent.order
      );
      if (relaxedResults.length > 0) {
        results = relaxedResults;
      }
    }

    if (results.length === 0) {
      const keywordOnlyResults = await tryRelaxedSearch(localIntent.filters || {}, executionContext);
      if (keywordOnlyResults.length > 0) {
        results = keywordOnlyResults;
      }
    }

    if (results.length === 0 && localIntent.filters?.deadline_within_days) {
      const nearestUpcoming = admissions
        .filter((item) => {
          if (!item.deadline) return false;
          const deadlineMs = new Date(item.deadline).getTime();
          return Number.isFinite(deadlineMs) && deadlineMs >= Date.now();
        })
        .sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime())
        .slice(0, MAX_RESULTS)
        .map(mapResult);

      return {
        intent: 'search_admissions',
        extracted_filters: localIntent.filters || {},
        clarification_needed: false,
        answer: formatDeadlineFallbackAnswer(localIntent.filters.deadline_within_days, nearestUpcoming),
        result_count: nearestUpcoming.length,
        results: nearestUpcoming,
      };
    }

    return {
      intent: 'search_admissions',
      extracted_filters: localIntent.filters || {},
      clarification_needed: false,
      answer: formatSearchAnswer(results, localIntent.filters || {}),
      result_count: results.length,
      results,
    };
  }

  if (localIntent.intent === 'summarize_saved_admissions') {
    const savedSummary = await summarizeSavedAdmissions(executionContext);
    return {
      intent: 'search_admissions',
      extracted_filters: {},
      clarification_needed: false,
      answer: savedSummary.answer,
      result_count: savedSummary.results.length,
      results: savedSummary.results,
    };
  }

  // Step 2a: guidance → separate free-text call at higher temperature
  if (extraction.intent === 'guidance') {
    let answer: string;
    try {
      answer = await generateText(
        buildGuidanceAnswerPrompt(message, enrichedContext, uniCtx),
        0.4
      );
    } catch (error) {
      if (isGeminiQuotaError(error)) {
        answer = [
          'AI quota is temporarily exhausted. You can still continue with this guidance:',
          buildLocalGuidance(message, uniCtx),
        ].join('\n');
      } else {
        answer = buildLocalGuidance(message, uniCtx);
      }
    }

    return {
      intent: 'guidance',
      extracted_filters: {},
      clarification_needed: false,
      answer: answer.trim(),
      result_count: 0,
      results: [],
    };
  }

  // Step 2b: truly unsupported
  if (extraction.intent === 'unsupported') {
    return {
      intent: 'unsupported',
      extracted_filters: {},
      clarification_needed: false,
      answer: extraction.refusal_reason || "I can help with admissions, programs, verification workflows, deadlines, and eligibility. Could you rephrase your question?",
      result_count: 0,
      results: [],
    };
  }

  // Step 2c: clarification — only as last resort
  if (extraction.intent === 'clarification') {
    return {
      intent: 'clarification',
      extracted_filters: filters,
      clarification_needed: true,
      clarification_question: extraction.clarification_question || undefined,
      answer: extraction.clarification_question || 'Could you share more details about what you are looking for?',
      result_count: 0,
      results: [],
    };
  }

  const { admissions: extractedAdmissions } = await admissionsService.getMany(
    {
      search: filters.search,
      degree_level: filters.degree_level,
      field_of_study: filters.field_of_study,
      location: filters.location,
      program_type: filters.program_type,
      delivery_mode: filters.delivery_mode,
    },
    1,
    MAX_RESULTS * 2,
    'deadline',
    'asc',
    executionContext.userContext
  );

  const filteredAdmissions = filterByDeadlineWindow(extractedAdmissions, filters.deadline_within_days);
  let results = filteredAdmissions.slice(0, MAX_RESULTS).map(mapResult);
  if (results.length === 0) {
    const relaxedResults = await tryRelaxedFilterSearch(filters, executionContext, 'deadline', 'asc');
      if (relaxedResults.length > 0) {
        results = relaxedResults;
      }
    }

  if (results.length === 0) {
    const keywordOnlyResults = await tryRelaxedSearch(filters, executionContext);
    if (keywordOnlyResults.length > 0) {
      results = keywordOnlyResults;
    }
  }

  if (results.length === 0 && filters.deadline_within_days) {
    const nearestUpcoming = extractedAdmissions
      .filter((item) => {
        if (!item.deadline) return false;
        const deadlineMs = new Date(item.deadline).getTime();
        return Number.isFinite(deadlineMs) && deadlineMs >= Date.now();
      })
      .sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime())
      .slice(0, MAX_RESULTS)
      .map(mapResult);

    return {
      intent: 'search_admissions',
      extracted_filters: filters,
      clarification_needed: false,
      answer: formatDeadlineFallbackAnswer(filters.deadline_within_days, nearestUpcoming),
      result_count: nearestUpcoming.length,
      results: nearestUpcoming,
    };
  }

  return {
    intent: 'search_admissions',
    extracted_filters: filters,
    clarification_needed: false,
    answer: formatSearchAnswer(results, filters),
    result_count: results.length,
    results,
  };
};
