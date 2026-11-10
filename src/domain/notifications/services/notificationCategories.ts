/**
 * Notification categories (the user-facing preference groups).
 *
 * One mapping for the in-process delivery path (email + push on create) and the
 * SQL used by the email catch-up/retry job, so both honour the same opt-outs.
 */

import { NOTIFICATION_TYPE } from '@config/constants';

export type NotificationCategory = 'verification' | 'deadline' | 'system' | 'update';

const VERIFICATION_TYPES: string[] = [
  NOTIFICATION_TYPE.ADMISSION_VERIFIED,
  NOTIFICATION_TYPE.ADMISSION_REJECTED,
  NOTIFICATION_TYPE.ADMISSION_REVISION_REQUIRED,
];
const SYSTEM_TYPES: string[] = [NOTIFICATION_TYPE.SYSTEM_BROADCAST, NOTIFICATION_TYPE.SYSTEM_ERROR];

export const inferNotificationCategory = (notificationType: string): NotificationCategory => {
  if (notificationType === NOTIFICATION_TYPE.DEADLINE_NEAR) return 'deadline';
  if (VERIFICATION_TYPES.includes(notificationType)) return 'verification';
  if (SYSTEM_TYPES.includes(notificationType)) return 'system';
  return 'update';
};

const sqlList = (values: string[]): string => values.map((value) => `'${value}'`).join(', ');

/**
 * SQL condition: the recipient still wants this notification by email.
 * Expects `n` (notifications) and `up` (user_preferences, LEFT JOINed on the
 * recipient) in scope. Values are constants, never user input.
 */
export const EMAIL_ALLOWED_SQL = `
  COALESCE(up.email_notifications_enabled, true) = true
  AND COALESCE((up.notification_categories ->> (
    CASE
      WHEN n.notification_type = '${NOTIFICATION_TYPE.DEADLINE_NEAR}' THEN 'deadline'
      WHEN n.notification_type IN (${sqlList(VERIFICATION_TYPES)}) THEN 'verification'
      WHEN n.notification_type IN (${sqlList(SYSTEM_TYPES)}) THEN 'system'
      ELSE 'update'
    END
  ))::boolean, true) = true`;
