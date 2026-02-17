/**
 * Admin Domain - Constants
 * 
 * Configuration values, action types, messages, and defaults
 * for the admin module.
 */

/**
 * Admin action types for audit logging
 */
export const ADMIN_ACTIONS = {
  VERIFY: 'verify',
  REJECT: 'reject',
  DISPUTE: 'dispute',
  BULK_VERIFY: 'bulk_verify',
  NOTES_UPDATE: 'notes_update',
  COMMENT_UPDATE: 'comment_update',
  STATUS_CHANGE: 'status_change',
  VIEW: 'view',
} as const;

/**
 * Valid status values for admissions
 */
export const ADMISSION_STATUSES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  DISPUTED: 'disputed',
} as const;

/**
 * Valid verification statuses (what admins can set)
 */
export const VERIFICATION_STATUSES = {
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  DISPUTED: 'disputed',
} as const;

/**
 * Admin operation success messages
 */
export const ADMIN_MESSAGES = {
  VERIFY_SUCCESS: 'Admission verified successfully',
  REJECT_SUCCESS: 'Admission rejected successfully',
  DISPUTE_SUCCESS: 'Admission marked as disputed successfully',
  BULK_VERIFY_SUCCESS: 'Bulk verification completed successfully',
  DASHBOARD_RETRIEVED: 'Admin dashboard retrieved successfully',
  PENDING_RETRIEVED: 'Pending admissions retrieved successfully',
  DETAILS_RETRIEVED: 'Admission details retrieved successfully',
} as const;

/**
 * Admin operation error messages
 */
export const ADMIN_ERRORS = {
  INVALID_STATUS_TRANSITION: 'Invalid status transition. Please check current status and allowed transitions.',
  REJECTION_REASON_REQUIRED: 'Rejection reason is required when rejecting an admission.',
  ADMISSION_NOT_FOUND: 'Admission not found. It may have been deleted.',
  UNAUTHORIZED: 'Admin access is required to perform this action.',
  DATABASE_ERROR: 'A database error occurred while processing your request.',
  INVALID_BULK_REQUEST: 'Invalid bulk request. All admission IDs must be valid UUIDs.',
  NO_ADMISSIONS_TO_PROCESS: 'No admissions found matching the criteria.',
} as const;

/**
 * Default pagination values
 */
export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
} as const;

/**
 * Dashboard configuration
 */
export const DASHBOARD_CONFIG = {
  RECENT_ACTIONS_LIMIT: 10,
  PENDING_ADMISSIONS_LIMIT: 5,
  STATS_CACHE_TTL: 60, // seconds
} as const;

/**
 * Validation constraints
 */
export const VALIDATION_CONSTRAINTS = {
  REJECTION_REASON_MIN_LENGTH: 10,
  REJECTION_REASON_MAX_LENGTH: 500,
  ADMIN_NOTES_MAX_LENGTH: 1000,
  VERIFICATION_COMMENTS_MAX_LENGTH: 1000,
  SEARCH_MAX_LENGTH: 100,
} as const;

/**
 * Audit log action descriptions
 */
export const AUDIT_LOG_DESCRIPTIONS = {
  [ADMIN_ACTIONS.VERIFY]: 'Verified admission application',
  [ADMIN_ACTIONS.REJECT]: 'Rejected admission application',
  [ADMIN_ACTIONS.DISPUTE]: 'Marked admission as disputed',
  [ADMIN_ACTIONS.BULK_VERIFY]: 'Performed bulk verification',
  [ADMIN_ACTIONS.NOTES_UPDATE]: 'Updated admin notes',
  [ADMIN_ACTIONS.COMMENT_UPDATE]: 'Updated verification comments',
  [ADMIN_ACTIONS.STATUS_CHANGE]: 'Changed admission status',
  [ADMIN_ACTIONS.VIEW]: 'Viewed admission details',
} as const;

/**
 * HTTP status codes for admin operations
 */
export const HTTP_STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/**
 * Sort field options for admin queries
 */
export const SORT_OPTIONS = {
  CREATED_AT: 'created_at',
  VERIFIED_AT: 'verified_at',
  STATUS: 'status',
} as const;

/**
 * Sort order options
 */
export const SORT_ORDER = {
  ASCENDING: 'asc',
  DESCENDING: 'desc',
} as const;
