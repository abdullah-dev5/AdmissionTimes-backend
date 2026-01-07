/**
 * Application Constants
 * 
 * Centralized constants used throughout the application.
 * This prevents magic strings and numbers in the codebase.
 */

/**
 * Admission verification statuses
 */
export const VERIFICATION_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  DISPUTED: 'disputed',
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

/**
 * User types
 */
export const USER_TYPE = {
  STUDENT: 'student',
  UNIVERSITY: 'university',
  ADMIN: 'admin',
} as const;

export type UserType = typeof USER_TYPE[keyof typeof USER_TYPE];

/**
 * Notification categories
 */
export const NOTIFICATION_CATEGORY = {
  VERIFICATION: 'verification',
  DEADLINE: 'deadline',
  SYSTEM: 'system',
  UPDATE: 'update',
} as const;

export type NotificationCategory = typeof NOTIFICATION_CATEGORY[keyof typeof NOTIFICATION_CATEGORY];

/**
 * Notification priorities
 */
export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type NotificationPriority = typeof NOTIFICATION_PRIORITY[keyof typeof NOTIFICATION_PRIORITY];

/**
 * Change log change types
 */
export const CHANGE_TYPE = {
  CREATED: 'created',
  UPDATED: 'updated',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  DISPUTED: 'disputed',
  STATUS_CHANGED: 'status_changed',
} as const;

export type ChangeType = typeof CHANGE_TYPE[keyof typeof CHANGE_TYPE];

/**
 * Deadline types
 */
export const DEADLINE_TYPE = {
  APPLICATION: 'application',
  DOCUMENT_SUBMISSION: 'document_submission',
  PAYMENT: 'payment',
  OTHER: 'other',
} as const;

export type DeadlineType = typeof DEADLINE_TYPE[keyof typeof DEADLINE_TYPE];

/**
 * Analytics event types
 */
export const ANALYTICS_EVENT_TYPE = {
  ADMISSION_VIEWED: 'admission_viewed',
  ADMISSION_CREATED: 'admission_created',
  ADMISSION_UPDATED: 'admission_updated',
  VERIFICATION_COMPLETED: 'verification_completed',
  VERIFICATION_REJECTED: 'verification_rejected',
  ADMISSION_SEARCHED: 'admission_searched',
} as const;

export type AnalyticsEventType = typeof ANALYTICS_EVENT_TYPE[keyof typeof ANALYTICS_EVENT_TYPE];

/**
 * User activity types
 */
export const ACTIVITY_TYPE = {
  VIEWED: 'viewed',
  SEARCHED: 'searched',
  COMPARED: 'compared',
  WATCHLISTED: 'watchlisted',
} as const;

export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE];

/**
 * API response messages
 */
export const API_MESSAGES = {
  SUCCESS: 'Success',
  ERROR: 'An error occurred',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

/**
 * Deadline urgency thresholds (in days)
 */
export const DEADLINE_URGENCY = {
  EXPIRED: 0,
  URGENT: 7,
  WARNING: 30,
} as const;
