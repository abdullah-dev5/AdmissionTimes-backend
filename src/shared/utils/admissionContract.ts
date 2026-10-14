/**
 * Admission response contract.
 *
 * Every admission the API returns passes through `withAdmissionContract`, which
 * adds display-ready fields so clients (web and mobile) render the same values
 * and never re-derive them with their own heuristics.
 *
 * Rule: additive only. Raw columns are kept; contract fields are added next to them.
 */

/** Where the data came from: entered by a university rep, or scraped from a public listing. */
export type AdmissionSource = 'university' | 'scraper';

export interface AdmissionContractFields {
  contract_version: number;
  source: AdmissionSource;
  /** Degree from `degree_level`, else inferred from the title; 'Not specified' when unknown. */
  degree_label: string;
  degree_type: string;
  deadline_iso: string | null;
  /** False when the admission has no deadline (status is then 'Open'). */
  has_deadline: boolean;
  /**
   * Calendar days from today to the deadline day, both in the app timezone
   * (APP_UTC_OFFSET): 0 = closes today, -1 = closed or no deadline (see has_deadline).
   */
  days_remaining: number;
  program_status: 'Open' | 'Closing Soon' | 'Closed';
  fee_amount: number | null;
  /** 'PKR 85,000', 'Free' (explicit 0) or 'Not specified' (unknown). */
  fee_display: string;
  /** Program location, else the university's city; null when unknown. */
  location_display: string | null;
  eligibility_text: string | null;
  university_website_url: string | null;
  admission_portal_url: string | null;
  /** Scraped admissions: the public announcement the data was taken from. */
  source_announcement_url: string | null;
  primary_apply_url: string | null;
  /** Programs covered by a scraped announcement (empty for single-program admissions). */
  programs_offered: string[];
  status_label: 'Verified' | 'Pending' | 'Closed' | 'Draft';
  match_label?: string;
}

const APP_UTC_OFFSET = process.env.APP_UTC_OFFSET || '+05:00';
const DAY_MS = 24 * 60 * 60 * 1000;

const offsetMs = (() => {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(APP_UTC_OFFSET);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) * 60000;
})();

const toObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
};

const readString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const readUrl = (value: unknown): string | null => {
  const text = readString(value);
  return text && /^https?:\/\//i.test(text) ? text : null;
};

const readDateIso = (value: unknown): string | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const text = readString(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Degree from free text (title or degree_level). Order matters: specific before generic. */
export const inferDegreeLabel = (text: string | null | undefined): string | null => {
  const value = String(text || '').toLowerCase();
  if (!value) return null;
  if (/\bphd\b|doctor of philosophy|doctorate/.test(value)) return 'PhD';
  if (/\bmphil\b|master of philosophy/.test(value)) return 'MPhil';
  if (/\bmba\b|master of business administration/.test(value)) return 'MBA';
  if (/\bbba\b|bachelor of business administration/.test(value)) return 'BBA';
  if (/\bmbbs\b|\bmd\b|doctor of medicine/.test(value)) return 'MD';
  if (/\bms\b|\bmsc\b|\bm\.s\b|master/.test(value)) return 'MS';
  if (/\bbs\b|\bbsc\b|\bbe\b|\bb\.ed\b|bachelor|undergraduate/.test(value)) return 'BS';
  return null;
};

const normalizeDegreeType = (degree: string): string => inferDegreeLabel(degree) || 'BS';

/** Day number (days since epoch) of an instant, counted in the app timezone. */
const appDay = (ms: number): number => Math.floor((ms + offsetMs) / DAY_MS);

export const calculateDaysRemaining = (deadlineIso: string | null, now: number = Date.now()): number => {
  if (!deadlineIso) return -1;
  const deadline = new Date(deadlineIso).getTime();
  if (Number.isNaN(deadline) || deadline < now) return -1;
  return appDay(deadline) - appDay(now);
};

const deriveProgramStatus = (daysRemaining: number, hasDeadline: boolean): 'Open' | 'Closing Soon' | 'Closed' => {
  if (!hasDeadline) return 'Open';
  if (daysRemaining < 0) return 'Closed';
  if (daysRemaining <= 7) return 'Closing Soon';
  return 'Open';
};

const deriveStatusLabel = (verificationStatus: string | null | undefined): 'Verified' | 'Pending' | 'Closed' | 'Draft' => {
  const status = String(verificationStatus || '').toLowerCase();
  if (status === 'verified') return 'Verified';
  if (status === 'rejected') return 'Closed';
  if (status === 'draft') return 'Draft';
  return 'Pending';
};

const deriveMatchLabel = (score: number): string => {
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'High Match';
  if (score >= 70) return 'Good Match';
  if (score >= 60) return 'Fair Match';
  // Below 60 is the engine's generic fallback (no profile signal): no label.
  return '';
};

const formatFee = (amount: number, currency: string): string =>
  amount === 0 ? 'Free' : `${currency} ${amount.toLocaleString('en-US')}`;

export const withAdmissionContract = <T extends Record<string, any>>(admission: T): T & AdmissionContractFields => {
  const requirements = toObject(admission.requirements);
  const links = toObject(requirements.links);
  const source: AdmissionSource = String(admission.data_origin || '').toLowerCase() === 'scraper' ? 'scraper' : 'university';

  const officialLinks = [...readStringArray(requirements.officialLinks), ...readStringArray(links.officialLinks)]
    .filter((link) => /^https?:\/\//i.test(link));

  const admissionPortalUrl =
    readUrl(admission.admission_portal_url) ||
    readUrl(admission.admission_portal_link) ||
    readUrl(requirements.admissionPortalLink) ||
    readUrl(requirements.admission_portal_link) ||
    readUrl(links.admissionPortalLink) ||
    readUrl(links.admission_portal_link) ||
    readUrl(links.portalUrl);

  const universityWebsiteUrl =
    readUrl(admission.university_website_url) ||
    readUrl(requirements.websiteUrl) ||
    readUrl(requirements.website_url) ||
    readUrl(links.websiteUrl) ||
    readUrl(links.website_url) ||
    readUrl(links.officialWebsite) ||
    // From the universities table (joined by the admissions queries).
    readUrl(admission.university_website) ||
    readUrl(admission.website_url);

  const sourceAnnouncementUrl =
    source === 'scraper'
      ? readUrl(admission.source_announcement_url) || readUrl(admission.source_url) || readUrl(requirements.source_details_link)
      : null;

  const primaryApplyUrl =
    readUrl(admission.primary_apply_url) ||
    admissionPortalUrl ||
    sourceAnnouncementUrl ||
    officialLinks[0] ||
    universityWebsiteUrl ||
    null;

  const eligibilityText =
    readString(admission.eligibility_text) ||
    readString(requirements.eligibility) ||
    readString(requirements.criteria) ||
    null;

  const degreeLabel =
    readString(admission.degree_label) ||
    readString(admission.degree_level) ||
    inferDegreeLabel(admission.title) ||
    'Not specified';
  const degreeType = readString(admission.degree_type) || normalizeDegreeType(degreeLabel);

  // pg returns timestamptz columns as Date objects; accept both shapes.
  const deadlineIso = readDateIso(admission.deadline) || readDateIso(admission.deadline_iso);
  const hasDeadline = deadlineIso !== null;
  // Always derived from the deadline: stored/client values could be stale.
  const daysRemaining = calculateDaysRemaining(deadlineIso);
  const programStatus = deriveProgramStatus(daysRemaining, hasDeadline);

  // A missing fee is unknown, not free: only an explicit 0 means free.
  const rawFee = admission.fee_amount ?? admission.application_fee;
  const hasFee = rawFee !== null && rawFee !== undefined && rawFee !== '' && Number.isFinite(Number(rawFee));
  const feeAmount = hasFee ? Number(rawFee) : null;
  const currency = readString(admission.currency)?.toUpperCase() || 'PKR';
  const feeDisplay = feeAmount !== null ? formatFee(feeAmount, currency) : 'Not specified';

  const locationDisplay =
    readString(admission.location) ||
    [readString(admission.university_city), readString(admission.university_country)].filter(Boolean).join(', ') ||
    null;

  const programsOffered = readStringArray(requirements.programs_offered);

  const matchScore = toFiniteNumber(admission.match_score, 0);
  const matchLabel = readString(admission.match_label) || deriveMatchLabel(matchScore);

  return {
    ...admission,
    contract_version: 3,
    source,
    degree_label: degreeLabel,
    degree_type: degreeType,
    deadline_iso: hasDeadline ? deadlineIso : null,
    has_deadline: hasDeadline,
    days_remaining: daysRemaining,
    program_status: programStatus,
    fee_amount: feeAmount,
    fee_display: feeDisplay,
    location_display: locationDisplay,
    eligibility_text: eligibilityText,
    university_website_url: universityWebsiteUrl,
    admission_portal_url: admissionPortalUrl,
    source_announcement_url: sourceAnnouncementUrl,
    primary_apply_url: primaryApplyUrl,
    // Single-program announcements just repeat the title; only multi-program lists are useful.
    programs_offered: programsOffered.length > 1 ? programsOffered : [],
    status_label: deriveStatusLabel(admission.verification_status),
    ...(matchLabel ? { match_label: matchLabel } : {}),
  };
};
