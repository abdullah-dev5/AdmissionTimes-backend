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
  MAINTENANCE: 'maintenance',
} as const;

export type UserType = typeof USER_TYPE[keyof typeof USER_TYPE];

/**
 * Notification types
 */
export const NOTIFICATION_TYPE = {
  ADMISSION_SUBMITTED: 'admission_submitted',
  ADMISSION_RESUBMITTED: 'admission_resubmitted',
  ADMISSION_VERIFIED: 'admission_verified',
  ADMISSION_REJECTED: 'admission_rejected',
  ADMISSION_REVISION_REQUIRED: 'admission_revision_required',
  ADMISSION_UPDATED_SAVED: 'admission_updated_saved',
  DEADLINE_NEAR: 'deadline_near',
  SYSTEM_BROADCAST: 'system_broadcast',
  DISPUTE_RAISED: 'dispute_raised',
  SYSTEM_ERROR: 'system_error',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPE[keyof typeof NOTIFICATION_TYPE];

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
  DECISION: 'decision',
  ENROLLMENT: 'enrollment',
  DOCUMENT: 'document',
  INTERVIEW: 'interview',
  DOCUMENT_SUBMISSION: 'document_submission',
  PAYMENT: 'payment',
  ORIENTATION: 'orientation',
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
  VIEW: 'view',
  SEARCH: 'search',
  SAVED: 'saved',
  ALERT: 'alert',
  DEADLINE: 'deadline',
  NOTIFICATION: 'notification',
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
