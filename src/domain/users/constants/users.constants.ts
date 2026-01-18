/**
 * Users Domain - Constants
 * 
 * Domain-specific constants for the users domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Field length limits
 */
export const FIELD_LIMITS = {
  DISPLAY_NAME_MIN: 2,
  DISPLAY_NAME_MAX: 255,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  STATUS: 'active' as const,
} as const;

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'created_at',
  'updated_at',
  'display_name',
  'role',
  'status',
] as const;

/**
 * User status values
 */
export const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;

export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];
