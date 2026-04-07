/**
 * Admission contract normalization helpers.
 *
 * Phase 0 rule: additive only. Never remove legacy fields.
 */

export interface AdmissionContractFields {
  contract_version: number;
  degree_label: string;
  degree_type: string;
  deadline_iso: string | null;
  days_remaining: number;
  program_status: 'Open' | 'Closing Soon' | 'Closed';
  fee_amount: number;
  fee_display: string;
  eligibility_text: string | null;
  university_website_url: string | null;
  admission_portal_url: string | null;
  primary_apply_url: string | null;
  status_label: 'Verified' | 'Pending' | 'Closed' | 'Draft';
  match_label?: string;
}

const toObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  return {};
};

const readString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

const normalizeDegreeType = (degree: string): string => {
  const value = degree.toUpperCase();
  if (value.includes('PHD')) return 'PhD';
  if (value.includes('MBA')) return 'MBA';
  if (value.includes('BBA')) return 'BBA';
  if (value.includes('MD')) return 'MD';
  if (value.includes('MPHIL')) return 'MPhil';
  if (value.includes('MS') || value.includes('MASTER')) return 'MS';
  return 'BS';
};

const calculateDaysRemaining = (deadline: string | null): number => {
  if (!deadline) return -1;

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return -1;

  const now = Date.now();
  const diffMs = deadlineDate.getTime() - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const deriveProgramStatus = (daysRemaining: number): 'Open' | 'Closing Soon' | 'Closed' => {
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
  if (score >= 50) return 'Match';
  return '';
};

export const withAdmissionContract = <T extends Record<string, any>>(admission: T): T & AdmissionContractFields => {
  const requirements = toObject(admission.requirements);
  const links = toObject(requirements.links);

  const officialLinks = [
    ...readStringArray(requirements.officialLinks),
    ...readStringArray(links.officialLinks),
  ];

  const admissionPortalUrl =
    readString(admission.admission_portal_url) ||
    readString(admission.admission_portal_link) ||
    readString(requirements.admissionPortalLink) ||
    readString(requirements.admission_portal_link) ||
    readString(links.admissionPortalLink) ||
    readString(links.admission_portal_link) ||
    readString(links.portalUrl);

  const universityWebsiteUrl =
    readString(admission.university_website_url) ||
    readString(admission.website_url) ||
    readString(requirements.websiteUrl) ||
    readString(requirements.website_url) ||
    readString(links.websiteUrl) ||
    readString(links.website_url) ||
    readString(links.officialWebsite);

  const primaryApplyUrl =
    readString(admission.primary_apply_url) ||
    admissionPortalUrl ||
    universityWebsiteUrl ||
    officialLinks[0] ||
    null;

  const eligibilityText =
    readString(admission.eligibility_text) ||
    readString(requirements.eligibility) ||
    readString(requirements.criteria) ||
    null;

  const degreeLabel = readString(admission.degree_label) || readString(admission.degree_level) || 'Degree Not Specified';
  const degreeType = readString(admission.degree_type) || normalizeDegreeType(degreeLabel);

  const deadlineIso = readString(admission.deadline_iso) || readString(admission.deadline);
  const daysRemaining = Number.isFinite(Number(admission.days_remaining))
    ? Number(admission.days_remaining)
    : calculateDaysRemaining(deadlineIso);
  const programStatus = (readString(admission.program_status) as 'Open' | 'Closing Soon' | 'Closed' | null) || deriveProgramStatus(daysRemaining);

  const feeAmount = Number.isFinite(Number(admission.fee_amount))
    ? Number(admission.fee_amount)
    : toFiniteNumber(admission.application_fee, 0);
  const feeDisplay = readString(admission.fee_display) || `PKR ${feeAmount.toLocaleString()}`;

  const matchScore = toFiniteNumber(admission.match_score, 0);
  const matchLabel = readString(admission.match_label) || deriveMatchLabel(matchScore);

  return {
    ...admission,
    contract_version: 2,
    degree_label: degreeLabel,
    degree_type: degreeType,
    deadline_iso: deadlineIso,
    days_remaining: daysRemaining,
    program_status: programStatus,
    fee_amount: feeAmount,
    fee_display: feeDisplay,
    eligibility_text: eligibilityText,
    university_website_url: universityWebsiteUrl,
    admission_portal_url: admissionPortalUrl,
    primary_apply_url: primaryApplyUrl,
    status_label: deriveStatusLabel(admission.verification_status),
    ...(matchLabel ? { match_label: matchLabel } : {}),
  };
};
