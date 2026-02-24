/**
 * Notifications Domain - Constants
 * 
 * Domain-specific constants for the notifications domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Field length limits
 */
export const FIELD_LIMITS = {
  TITLE_MAX: 255,
  MESSAGE_MAX: 5000,
  ACTION_URL_MAX: 500,
  RELATED_ENTITY_TYPE_MAX: 100,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  PRIORITY: 'medium' as const,
  IS_READ: false,
} as const;

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'created_at',
  'read_at',
  'priority',
  'notification_type',
] as const;
