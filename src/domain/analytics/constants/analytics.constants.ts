/**
 * Analytics Domain - Constants
 * 
 * Domain-specific constants for the analytics domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'created_at',
  'event_type',
  'entity_type',
] as const;

/**
 * Default aggregation period (in days)
 */
export const AGGREGATION_PERIODS = {
  TODAY: 1,
  THIS_WEEK: 7,
  THIS_MONTH: 30,
} as const;
