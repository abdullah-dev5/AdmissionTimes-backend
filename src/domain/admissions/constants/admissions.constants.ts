/**
 * Admissions Domain - Constants
 * 
 * Domain-specific constants for the admissions domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Field length limits
 */
export const FIELD_LIMITS = {
  TITLE_MAX: 255,
  DESCRIPTION_MAX: 5000,
  FIELD_OF_STUDY_MAX: 255,
  DURATION_MAX: 100,
  CURRENCY_LENGTH: 3,
  LOCATION_MAX: 255,
  CAMPUS_MAX: 255,
  REJECTION_REASON_MIN: 10,
  REJECTION_REASON_MAX: 1000,
} as const;

/**
 * Validation rules
 */
export const VALIDATION_RULES = {
  TUITION_FEE_MIN: 0,
  APPLICATION_FEE_MIN: 0,
  DEADLINE_MUST_BE_FUTURE: true,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  VERIFICATION_STATUS: 'draft' as const,
  IS_ACTIVE: true,
  DELIVERY_MODE_OPTIONS: ['on-campus', 'online', 'hybrid'] as const,
} as const;

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'created_at',
  'updated_at',
  'deadline',
  'title',
  'tuition_fee',
  'verified_at',
] as const;

/**
 * Search fields
 * Fields that are searched when using the search parameter
 */
export const SEARCH_FIELDS = [
  'title',
  'description',
  'field_of_study',
  'location',
  'campus',
] as const;
