/**
 * Changelogs Domain - Constants
 * 
 * Domain-specific constants for the changelogs domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'created_at',
  'action_type',
  'actor_type',
] as const;
