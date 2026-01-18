/**
 * User Activity Domain - Constants
 * 
 * Domain-specific constants for the user activity domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Entity types that can be tracked
 */
export const ENTITY_TYPES = {
  ADMISSION: 'admission',
} as const;

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'created_at',
  'activity_type',
  'entity_type',
] as const;
