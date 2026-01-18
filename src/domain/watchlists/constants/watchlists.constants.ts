/**
 * Watchlists Domain - Constants
 * 
 * Domain-specific constants for the watchlists domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Field length limits
 */
export const FIELD_LIMITS = {
  NOTES_MAX: 5000,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
  SORT: 'created_at' as const,
  ORDER: 'desc' as const,
} as const;

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'created_at',
  'updated_at',
] as const;
