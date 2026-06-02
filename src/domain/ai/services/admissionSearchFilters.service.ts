/**
 * Centralized admission search filter resolution for AI chat.
 * Search-first strategy: avoid stacking strict column filters that hide valid rows.
 */

import { AdmissionChatFilters } from '../types/ai.types';

const SEARCH_NOISE_WORDS = new Set([
  'show', 'find', 'list', 'any', 'open', 'latest', 'urgent', 'deadline', 'deadlines',
  'admission', 'admissions', 'admssion', 'please', 'me', 'my', 'all', 'in', 'with', 'for',
  'the', 'this', 'week', 'month', 'there', 'is', 'are', 'what', 'which', 'how', 'do', 'does',
  'can', 'could', 'would', 'tell', 'give', 'want', 'need', 'programs', 'program', 'closing',
  'close', 'closes', 'closed', 'available', 'offered', 'offer', 'offers',
]);

const PROGRAM_CODE_PATTERNS: Array<{ pattern: RegExp; token: string }> = [
  { pattern: /\bbba\b/i, token: 'bba' },
  { pattern: /\bmba\b/i, token: 'mba' },
  { pattern: /\bmphil\b/i, token: 'mphil' },
  { pattern: /\bphd\b/i, token: 'phd' },
  { pattern: /\bllb\b/i, token: 'llb' },
  { pattern: /\bllm\b/i, token: 'llm' },
  { pattern: /\bbsc\b/i, token: 'bsc' },
  { pattern: /\bbs\b/i, token: 'bs' },
  { pattern: /\bbe\b/i, token: 'be' },
  { pattern: /\bmsc\b/i, token: 'msc' },
  { pattern: /\bms\b/i, token: 'ms' },
  { pattern: /\bcs\b/i, token: 'cs' },
  { pattern: /\bbit\b/i, token: 'bit' },
  { pattern: /\bmit\b/i, token: 'mit' },
];

const FIELD_TOPIC_PATTERNS: Array<{ pattern: RegExp; tokens: string[] }> = [
  { pattern: /computer\s*science|software\s*engineering|artificial\s*intelligence/i, tokens: ['computer', 'science'] },
  { pattern: /data\s*science|analytics/i, tokens: ['data', 'science'] },
  { pattern: /business\s*administration|business\s*studies/i, tokens: ['business'] },
  { pattern: /\bbusiness\b/i, tokens: ['business'] },
  { pattern: /electrical\s*engineering|electronics/i, tokens: ['electrical', 'engineering'] },
  { pattern: /mechanical\s*engineering|mechatronics/i, tokens: ['mechanical', 'engineering'] },
  { pattern: /civil\s*engineering/i, tokens: ['civil', 'engineering'] },
  { pattern: /economics|econometrics/i, tokens: ['economics'] },
  { pattern: /finance|accounting/i, tokens: ['finance'] },
  { pattern: /medicine|medical|mbbs/i, tokens: ['medicine'] },
  { pattern: /law|legal/i, tokens: ['law'] },
];

const CITY_HINTS = [
  'lahore', 'karachi', 'islamabad', 'rawalpindi', 'faisalabad', 'multan', 'peshawar', 'quetta', 'sialkot',
  'hyderabad', 'sukkur', 'abbottabad',
];

const normalizeQueryText = (message: string): string => {
  let normalized = String(message || '')
    .toLowerCase()
    .replace(/['']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ');

  normalized = normalized
    .replace(/\badmssion\b/g, 'admission')
    .replace(/\bprogam\b/g, 'program')
    .replace(/\bprogams\b/g, 'programs');

  return normalized.replace(/\s+/g, ' ').trim();
};

export const extractProgramCodeTokens = (message: string): string[] => {
  const lower = normalizeQueryText(message);
  const found: string[] = [];
  for (const entry of PROGRAM_CODE_PATTERNS) {
    if (entry.pattern.test(lower)) {
      found.push(entry.token);
    }
  }
  return found;
};

const extractFieldTopicTokens = (message: string): string[] => {
  const lower = normalizeQueryText(message);
  if (extractProgramCodeTokens(message).length > 0) {
    return [];
  }
  for (const entry of FIELD_TOPIC_PATTERNS) {
    if (entry.pattern.test(lower)) {
      return entry.tokens;
    }
  }
  return [];
};

const extractLocation = (message: string): string | undefined => {
  const lower = normalizeQueryText(message);
  const city = CITY_HINTS.find((candidate) => new RegExp(`\\b${candidate}\\b`).test(lower));
  return city ? city.charAt(0).toUpperCase() + city.slice(1) : undefined;
};

const extractProgramType = (message: string): string | undefined => {
  const lower = normalizeQueryText(message);
  if (extractProgramCodeTokens(message).length > 0) {
    return undefined;
  }
  if (/\b(undergraduate|ug|bachelor|bachelors)\b/.test(lower)) {
    return 'undergraduate';
  }
  if (/\b(graduate|postgraduate|pg|master|masters)\b/.test(lower)) {
    return 'graduate';
  }
  return undefined;
};

const extractDegreeLevel = (message: string): string | undefined => {
  const lower = normalizeQueryText(message);
  if (extractProgramCodeTokens(message).length > 0) {
    return undefined;
  }
  if (/\b(master|masters|postgraduate|graduate|mphil)\b/.test(lower)) {
    return 'master';
  }
  if (/\b(bachelor|bachelors|undergraduate)\b/.test(lower)) {
    return 'bachelor';
  }
  if (/\b(phd|doctorate)\b/.test(lower)) {
    return 'phd';
  }
  if (/\b(diploma)\b/.test(lower)) {
    return 'diploma';
  }
  return undefined;
};

const extractFreeTextTokens = (message: string): string[] => {
  const lower = normalizeQueryText(message);
  return lower
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .filter((token) => !SEARCH_NOISE_WORDS.has(token))
    .filter((token) => !CITY_HINTS.includes(token))
    .filter((token) => !Object.keys({ january: 1, february: 1, march: 1, april: 1, may: 1, june: 1, july: 1, august: 1, september: 1, october: 1, november: 1, december: 1 }).includes(token));
};

/**
 * Build a single search string from program codes, field topics, and leftover tokens.
 */
export const buildSearchTermsFromMessage = (message: string): string | undefined => {
  const programCodes = extractProgramCodeTokens(message);
  const fieldTokens = extractFieldTopicTokens(message);
  const freeTokens = extractFreeTextTokens(message);

  const combined = Array.from(new Set([...programCodes, ...fieldTokens, ...freeTokens])).slice(0, 6);
  if (combined.length === 0) {
    return undefined;
  }

  return combined.join(' ');
};

/**
 * Search-first filters for AI admission queries.
 * Optional degree_level / program_type only when no program code tokens are present.
 */
export const buildSearchFirstFilters = (
  message: string,
  options?: {
    deadline_within_days?: number;
    deadline_on?: string;
  }
): AdmissionChatFilters => {
  const search = buildSearchTermsFromMessage(message);
  const location = extractLocation(message);
  const programType = extractProgramType(message);
  const degreeLevel = extractDegreeLevel(message);

  const filters: AdmissionChatFilters = {
    search,
    location,
    program_type: programType,
    degree_level: degreeLevel,
    deadline_within_days: options?.deadline_within_days,
    deadline_on: options?.deadline_on,
  };

  return filters;
};

/**
 * Prefer text search over strict column filters when program codes or topic tokens are present.
 */
export const applySearchFirstPolicy = (
  message: string,
  filters: AdmissionChatFilters
): AdmissionChatFilters => {
  const programCodes = extractProgramCodeTokens(message);
  const searchFromMessage = buildSearchTermsFromMessage(message);
  const next: AdmissionChatFilters = { ...filters };

  if (programCodes.length > 0) {
    next.search = searchFromMessage || next.search || programCodes.join(' ');
    next.field_of_study = undefined;
    next.degree_level = undefined;
    next.program_type = undefined;
    return next;
  }

  if (searchFromMessage && !next.search) {
    next.search = searchFromMessage;
  }

  if (next.search && next.field_of_study) {
    next.field_of_study = undefined;
  }

  return next;
};

/**
 * Progressive relaxation candidates (broadest first for recall).
 */
export const buildSearchRelaxationCandidates = (filters: AdmissionChatFilters): AdmissionChatFilters[] => {
  const seen = new Set<string>();
  const candidates: AdmissionChatFilters[] = [];

  const push = (candidate: AdmissionChatFilters) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(candidate);
  };

  if (filters.search) {
    push({ search: filters.search });
    push({
      search: filters.search,
      location: filters.location,
      deadline_within_days: filters.deadline_within_days,
      deadline_on: filters.deadline_on,
    });
  }

  push({
    search: filters.search,
    location: filters.location,
    program_type: filters.program_type,
    degree_level: filters.degree_level,
    deadline_within_days: filters.deadline_within_days,
    deadline_on: filters.deadline_on,
  });

  if (filters.location) {
    push({ location: filters.location, deadline_within_days: filters.deadline_within_days });
  }

  if (filters.program_type) {
    push({ program_type: filters.program_type });
  }

  if (filters.degree_level) {
    push({ degree_level: filters.degree_level });
  }

  return candidates;
};
