/**
 * Deadlines Domain - Constants
 * 
 * Domain-specific constants for the deadlines domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Urgency level thresholds (in days)
 */
export const URGENCY_THRESHOLDS = {
  EXPIRED: 0,
  CRITICAL: 7,
  HIGH: 14,
  MEDIUM: 30,
  LOW: 90,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  TIMEZONE: 'UTC',
  IS_FLEXIBLE: false,
  REMINDER_SENT: false,
} as const;

/**
 * Sortable fields
 */
export const SORTABLE_FIELDS = [
  'deadline_date',
  'created_at',
  'updated_at',
  'deadline_type',
] as const;
