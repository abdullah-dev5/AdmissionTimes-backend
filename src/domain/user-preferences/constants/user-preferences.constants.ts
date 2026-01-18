/**
 * User Preferences Domain - Constants
 * 
 * Domain-specific constants for the user preferences domain.
 * Prevents magic strings and numbers in the codebase.
 */

/**
 * Default preference values
 */
export const DEFAULTS = {
  EMAIL_NOTIFICATIONS_ENABLED: true,
  EMAIL_FREQUENCY: 'immediate' as const,
  PUSH_NOTIFICATIONS_ENABLED: true,
  LANGUAGE: 'en' as const,
  TIMEZONE: 'UTC',
  THEME: 'light' as const,
  NOTIFICATION_CATEGORIES: {
    verification: true,
    deadline: true,
    system: true,
    update: true,
  },
} as const;

/**
 * Email frequency options
 */
export const EMAIL_FREQUENCY_OPTIONS = [
  'immediate',
  'daily',
  'weekly',
  'never',
] as const;

/**
 * Language options
 */
export const LANGUAGE_OPTIONS = [
  'en',
  'ar',
  'fr',
  'es',
] as const;

/**
 * Theme options
 */
export const THEME_OPTIONS = [
  'light',
  'dark',
  'auto',
] as const;

/**
 * Notification category keys
 */
export const NOTIFICATION_CATEGORIES = {
  VERIFICATION: 'verification',
  DEADLINE: 'deadline',
  SYSTEM: 'system',
  UPDATE: 'update',
} as const;
