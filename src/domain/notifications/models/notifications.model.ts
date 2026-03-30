/**
 * Notifications Domain - Model Layer
 * 
 * Database access layer for notifications.
 * Contains all raw SQL queries with parameterized statements.
 * 
 * Responsibilities:
 * - Execute database queries
 * - Handle pagination
 * - Handle filtering
 * - Return raw data (no transformation)
 * 
 * NO business logic - that belongs in the service layer.
 */

import { query } from '@db/connection';
import { Notification, NotificationFilters, CreateNotificationDTO } from '../types/notifications.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS } from '../constants/notifications.constants';
import { DEFAULTS } from '../constants/notifications.constants';

/**
 * Find notification by ID
 * 
 * @param id - Notification UUID
 * @returns Notification record or null if not found
 */
export const findById = async (id: string): Promise<Notification | null> => {
  const sql = 'SELECT * FROM notifications WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Count notifications matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching notifications
 */
export const count = async (filters: NotificationFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple notifications with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of notification records
 */
export const findMany = async (
  filters: NotificationFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<Notification[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Create a new notification
 * 
 * @param data - Notification data
 * @returns Created notification record
 */
export const create = async (data: CreateNotificationDTO): Promise<Notification> => {
  console.log(`📊 [DB] Attempting to create notification:`, {
    recipient_id: data.recipient_id,
    role_type: data.role_type,
    notification_type: data.notification_type,
    related_entity_id: data.related_entity_id,
    event_key: data.event_key,
    title: data.title?.substring(0, 50),
  });

  const sql = `
    INSERT INTO notifications (
      recipient_id, role_type, notification_type, priority, title, message,
      related_entity_type, related_entity_id, action_url, is_read, event_key
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (recipient_id, notification_type, related_entity_id, event_key)
    DO NOTHING
    RETURNING *
  `;

  const params = [
    data.recipient_id || null,
    data.role_type,
    data.notification_type,
    data.priority || DEFAULTS.PRIORITY,
    data.title,
    data.message,
    data.related_entity_type || null,
    data.related_entity_id || null,
    data.action_url || null,
    DEFAULTS.IS_READ,
    data.event_key,
  ];

  const result = await query(sql, params);
  if (result.rows[0]) {
    console.log(`✅ [DB] Notification created successfully:`, { id: result.rows[0].id, created_at: result.rows[0].created_at });
    return result.rows[0];
  }

  console.log(`⚠️ [DB] INSERT returned no rows - checking if duplicate via constraint...`);

  const fallbackSql = `
    SELECT * FROM notifications
    WHERE recipient_id = $1
      AND notification_type = $2
      AND related_entity_id IS NOT DISTINCT FROM $3
      AND event_key = $4
    LIMIT 1
  `;
  const fallback = await query(fallbackSql, [
    data.recipient_id || null,
    data.notification_type,
    data.related_entity_id || null,
    data.event_key,
  ]);
  
  if (fallback.rows[0]) {
    console.log(`✅ [DB] Found existing notification via fallback (duplicate suppressed):`, { id: fallback.rows[0].id, created_at: fallback.rows[0].created_at });
    return { ...fallback.rows[0], __existing: true } as Notification;
  }
  
  // This should never happen - either INSERT succeeds or constraint hits
  console.error(`❌ [DB] CRITICAL: Notification not created and not found in fallback query`);
  console.error(`   → recipient_id: ${data.recipient_id}`);
  console.error(`   → notification_type: ${data.notification_type}`);
  console.error(`   → event_key: ${data.event_key}`);
  
  throw new Error(`Failed to create or find notification: recipient=${data.recipient_id}, type=${data.notification_type}, event_key=${data.event_key}`);

};

/**
 * Mark notification as read
 * 
 * @param id - Notification UUID
 * @param readAt - Read timestamp (defaults to now)
 * @returns Updated notification record or null if not found
 */
export const markAsRead = async (
  id: string,
  readAt: string | null = null
): Promise<Notification | null> => {
  const sql = `
    UPDATE notifications
    SET is_read = true, read_at = COALESCE($1, NOW())
    WHERE id = $2
    RETURNING *
  `;

  const result = await query(sql, [readAt, id]);
  return result.rows[0] || null;
};

/**
 * Mark all notifications as read for a user
 * 
 * @param userId - User UUID (optional)
 * @param userType - User type
 * @returns Number of notifications marked as read
 */
export const markAllAsRead = async (
  recipientId: string,
  roleType: string
): Promise<number> => {
  const sql = `
    UPDATE notifications
    SET is_read = true, read_at = NOW()
    WHERE recipient_id = $1 AND role_type = $2 AND is_read = false
  `;
  const params = [recipientId, roleType];

  const result = await query(sql, params);
  return result.rowCount || 0;
};

/**
 * Get unread count for a user
 * 
 * @param userId - User UUID (optional)
 * @param userType - User type
 * @returns Unread notification count
 */
export const getUnreadCount = async (
  recipientId: string,
  roleType: string
): Promise<number> => {
  const sql = `
    SELECT COUNT(*) as count
    FROM notifications
    WHERE recipient_id = $1 AND role_type = $2 AND is_read = false
  `;
  const params = [recipientId, roleType];

  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Delete a notification
 * 
 * @param id - Notification UUID
 * @returns True if deleted, false if not found
 */
export const deleteById = async (id: string): Promise<boolean> => {
  const sql = 'DELETE FROM notifications WHERE id = $1';
  const result = await query(sql, [id]);
  return (result.rowCount || 0) > 0;
};

/**
 * Delete deadline reminder notifications for a specific deadline.
 *
 * Used when a deadline date changes so reminder lifecycle can restart cleanly
 * for 7/3/1 thresholds without stale deduplication state.
 *
 * @param deadlineId - Deadline UUID
 * @returns Number of notifications deleted
 */
export const deleteDeadlineReminderNotificationsByDeadlineId = async (
  deadlineId: string
): Promise<number> => {
  const sql = `
    DELETE FROM notifications
    WHERE notification_type = 'deadline_near'
      AND related_entity_type = 'deadline'
      AND related_entity_id = $1
  `;

  const result = await query(sql, [deadlineId]);
  return result.rowCount || 0;
};

/**
 * Delete reminder notifications generated by manual force-run testing.
 *
 * Matches event keys with ':manual-' suffix used by force_run mode.
 */
export const deleteManualTestDeadlineNotifications = async (): Promise<number> => {
  const sql = `
    DELETE FROM notifications
    WHERE notification_type = 'deadline_near'
      AND event_key LIKE '%:manual-%'
  `;

  const result = await query(sql, []);
  return result.rowCount || 0;
};

export interface EmailDeliveryLogInput {
  notification_id: string;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'failed';
  error_message?: string | null;
  attempt_number: number;
  provider_message_id?: string | null;
}

export const createEmailDeliveryLog = async (input: EmailDeliveryLogInput): Promise<void> => {
  const sql = `
    INSERT INTO email_delivery_logs (
      notification_id,
      recipient_email,
      subject,
      status,
      error_message,
      attempt_number,
      provider_message_id
    )
    VALUES ($1::uuid, $2, $3, $4::varchar(20), $5, $6, $7)
  `;

  await query(sql, [
    input.notification_id,
    input.recipient_email,
    input.subject,
    input.status,
    input.error_message || null,
    input.attempt_number,
    input.provider_message_id || null,
  ]);
};

export const findEmailDeliveryLogs = async (
  filters?: { status?: 'sent' | 'failed'; limit?: number }
): Promise<any[]> => {
  const status = filters?.status || null;
  const limit = Math.min(200, Math.max(1, filters?.limit || 50));

  const sql = `
    SELECT
      l.id::text,
      l.notification_id::text,
      l.recipient_email,
      l.subject,
      l.status,
      l.error_message,
      l.attempt_number,
      l.provider_message_id,
      l.created_at,
      n.notification_type::text,
      n.title as notification_title,
      n.related_entity_type,
      n.related_entity_id::text
    FROM email_delivery_logs l
    LEFT JOIN notifications n ON n.id = l.notification_id
    WHERE ($1::text IS NULL OR l.status = $1::text)
    ORDER BY l.created_at DESC
    LIMIT $2
  `;

  const result = await query(sql, [status, limit]);
  return result.rows;
};

export const findEmailDeliveryLogById = async (id: string): Promise<any | null> => {
  const sql = `
    SELECT
      id::text,
      notification_id::text,
      recipient_email,
      subject,
      status,
      error_message,
      attempt_number,
      provider_message_id,
      created_at
    FROM email_delivery_logs
    WHERE id = $1::uuid
    LIMIT 1
  `;

  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

export interface EmailRetryCandidate {
  id: string;
  recipient_id: string | null;
  role_type: string;
  notification_type: string;
  priority: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  event_key: string;
  created_at: string;
  updated_at: string;
  recipient_email: string;
  failed_count: number;
  last_failed_at: string;
  last_failed_error_message: string | null;
  last_failed_attempt_number: number;
}

export const findEmailRetryCandidates = async (input?: {
  limit?: number;
  maxFailedAttempts?: number;
  minAgeSeconds?: number;
}): Promise<EmailRetryCandidate[]> => {
  const limit = Math.min(200, Math.max(1, input?.limit || 50));
  const maxFailedAttempts = Math.max(1, input?.maxFailedAttempts || 6);
  const minAgeSeconds = Math.max(0, input?.minAgeSeconds || 60);

  const sql = `
    WITH delivery_agg AS (
      SELECT
        notification_id,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
        MAX(created_at) FILTER (WHERE status = 'failed') AS last_failed_at,
        MAX(created_at) FILTER (WHERE status = 'sent') AS last_sent_at
      FROM email_delivery_logs
      GROUP BY notification_id
    )
    SELECT
      n.*,
      lf.recipient_email,
      lf.error_message AS last_failed_error_message,
      lf.attempt_number::int AS last_failed_attempt_number,
      da.failed_count::int,
      da.last_failed_at
    FROM delivery_agg da
    JOIN notifications n ON n.id = da.notification_id
    JOIN LATERAL (
      SELECT recipient_email, error_message, attempt_number
      FROM email_delivery_logs l
      WHERE l.notification_id = da.notification_id
        AND l.status = 'failed'
      ORDER BY l.created_at DESC
      LIMIT 1
    ) lf ON true
    WHERE da.last_sent_at IS NULL
      AND da.failed_count > 0
      AND da.failed_count < $1
      AND da.last_failed_at <= NOW() - ($2::text || ' seconds')::interval
    ORDER BY da.last_failed_at ASC
    LIMIT $3
  `;

  const result = await query(sql, [maxFailedAttempts, minAgeSeconds, limit]);
  return result.rows;
};

export const countEmailRetryBacklog = async (input?: {
  maxFailedAttempts?: number;
  minAgeSeconds?: number;
}): Promise<number> => {
  const maxFailedAttempts = Math.max(1, input?.maxFailedAttempts || 6);
  const minAgeSeconds = Math.max(0, input?.minAgeSeconds || 60);

  const sql = `
    WITH delivery_agg AS (
      SELECT
        notification_id,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
        MAX(created_at) FILTER (WHERE status = 'failed') AS last_failed_at,
        MAX(created_at) FILTER (WHERE status = 'sent') AS last_sent_at
      FROM email_delivery_logs
      GROUP BY notification_id
    )
    SELECT COUNT(*)::int AS count
    FROM delivery_agg da
    WHERE da.last_sent_at IS NULL
      AND da.failed_count > 0
      AND da.failed_count < $1
      AND da.last_failed_at <= NOW() - ($2::text || ' seconds')::interval
  `;

  const result = await query(sql, [maxFailedAttempts, minAgeSeconds]);
  return result.rows[0]?.count || 0;
};

export interface EmailUnattemptedCandidate {
  id: string;
  recipient_id: string | null;
  role_type: string;
  notification_type: string;
  priority: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  event_key: string;
  created_at: string;
  recipient_email: string;
}

export const findEmailUnattemptedCandidates = async (input?: {
  limit?: number;
  minAgeSeconds?: number;
  maxAgeHours?: number;
}): Promise<EmailUnattemptedCandidate[]> => {
  const limit = Math.min(200, Math.max(1, input?.limit || 50));
  const minAgeSeconds = Math.max(0, input?.minAgeSeconds || 60);
  const maxAgeHours = Math.max(1, input?.maxAgeHours || 72);

  const sql = `
    SELECT
      n.id::text,
      n.recipient_id::text,
      n.role_type::text,
      n.notification_type::text,
      n.priority::text,
      n.title,
      n.message,
      n.related_entity_type,
      n.related_entity_id::text,
      n.action_url,
      n.is_read,
      n.read_at,
      n.event_key,
      n.created_at,
      u.email AS recipient_email
    FROM notifications n
    JOIN users u ON u.id = n.recipient_id
    LEFT JOIN LATERAL (
      SELECT 1 AS has_log
      FROM email_delivery_logs l
      WHERE l.notification_id = n.id
      LIMIT 1
    ) log_ref ON TRUE
    WHERE n.recipient_id IS NOT NULL
      AND u.email IS NOT NULL
      AND COALESCE(u.status, 'active') = 'active'
      AND log_ref.has_log IS NULL
      AND n.created_at <= NOW() - ($1::text || ' seconds')::interval
      AND n.created_at >= NOW() - ($2::text || ' hours')::interval
    ORDER BY n.created_at ASC
    LIMIT $3
  `;

  const result = await query(sql, [minAgeSeconds, maxAgeHours, limit]);
  return result.rows;
};

export const countEmailUnattemptedBacklog = async (input?: {
  minAgeSeconds?: number;
  maxAgeHours?: number;
}): Promise<number> => {
  const minAgeSeconds = Math.max(0, input?.minAgeSeconds || 60);
  const maxAgeHours = Math.max(1, input?.maxAgeHours || 72);

  const sql = `
    SELECT COUNT(*)::int AS count
    FROM notifications n
    JOIN users u ON u.id = n.recipient_id
    LEFT JOIN LATERAL (
      SELECT 1 AS has_log
      FROM email_delivery_logs l
      WHERE l.notification_id = n.id
      LIMIT 1
    ) log_ref ON TRUE
    WHERE n.recipient_id IS NOT NULL
      AND u.email IS NOT NULL
      AND COALESCE(u.status, 'active') = 'active'
      AND log_ref.has_log IS NULL
      AND n.created_at <= NOW() - ($1::text || ' seconds')::interval
      AND n.created_at >= NOW() - ($2::text || ' hours')::interval
  `;

  const result = await query(sql, [minAgeSeconds, maxAgeHours]);
  return result.rows[0]?.count || 0;
};

export interface EmailDeliveryMetrics {
  sent_1h: number;
  failed_1h: number;
  sent_24h: number;
  failed_24h: number;
  permanent_skips_24h: number;
  retry_attempts_24h: number;
}

export const getEmailDeliveryMetrics = async (): Promise<EmailDeliveryMetrics> => {
  const sql = `
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'sent'
          AND created_at >= NOW() - INTERVAL '1 hour'
      )::int AS sent_1h,
      COUNT(*) FILTER (
        WHERE status = 'failed'
          AND created_at >= NOW() - INTERVAL '1 hour'
      )::int AS failed_1h,
      COUNT(*) FILTER (
        WHERE status = 'sent'
          AND created_at >= NOW() - INTERVAL '24 hours'
      )::int AS sent_24h,
      COUNT(*) FILTER (
        WHERE status = 'failed'
          AND created_at >= NOW() - INTERVAL '24 hours'
      )::int AS failed_24h,
      COUNT(*) FILTER (
        WHERE status = 'failed'
          AND created_at >= NOW() - INTERVAL '24 hours'
          AND error_message LIKE '[PERMANENT_SKIP]%'
      )::int AS permanent_skips_24h,
      COUNT(*) FILTER (
        WHERE created_at >= NOW() - INTERVAL '24 hours'
          AND attempt_number > 1
      )::int AS retry_attempts_24h
    FROM email_delivery_logs
  `;

  const result = await query(sql, []);
  const row = result.rows[0] || {};
  return {
    sent_1h: row.sent_1h || 0,
    failed_1h: row.failed_1h || 0,
    sent_24h: row.sent_24h || 0,
    failed_24h: row.failed_24h || 0,
    permanent_skips_24h: row.permanent_skips_24h || 0,
    retry_attempts_24h: row.retry_attempts_24h || 0,
  };
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: NotificationFilters): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // User ID filter
  if (filters.recipient_id !== undefined) {
    if (filters.recipient_id === null) {
      conditions.push('recipient_id IS NULL');
    } else {
      conditions.push(`recipient_id = $${paramIndex++}`);
      params.push(filters.recipient_id);
    }
  }

  // Role type filter
  if (filters.role_type) {
    conditions.push(`role_type = $${paramIndex++}`);
    params.push(filters.role_type);
  }

  // Notification type filter
  if (filters.notification_type) {
    conditions.push(`notification_type = $${paramIndex++}`);
    params.push(filters.notification_type);
  }

  // Priority filter
  if (filters.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    params.push(filters.priority);
  }

  // Read status filter
  if (filters.is_read !== undefined) {
    conditions.push(`is_read = $${paramIndex++}`);
    params.push(filters.is_read);
  }

  // Related entity type filter
  if (filters.related_entity_type) {
    conditions.push(`related_entity_type = $${paramIndex++}`);
    params.push(filters.related_entity_type);
  }

  // Related entity ID filter
  if (filters.related_entity_id) {
    conditions.push(`related_entity_id = $${paramIndex++}`);
    params.push(filters.related_entity_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM notifications ${whereClause}`;
  return { sql, params };
}

/**
 * Build FIND MANY query with filters, sorting, and pagination
 * 
 * @param filters - Filter criteria
 * @param sort - Field to sort by
 * @param order - Sort order
 * @param limit - Items per page
 * @param offset - Offset for pagination
 * @returns SQL query and parameters
 */
function buildFindManyQuery(
  filters: NotificationFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number
): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Apply same filters as count query
  if (filters.recipient_id !== undefined) {
    if (filters.recipient_id === null) {
      conditions.push('n.recipient_id IS NULL');
    } else {
      conditions.push(`n.recipient_id = $${paramIndex++}`);
      params.push(filters.recipient_id);
    }
  }

  if (filters.role_type) {
    conditions.push(`n.role_type = $${paramIndex++}`);
    params.push(filters.role_type);
  }

  if (filters.notification_type) {
    conditions.push(`n.notification_type = $${paramIndex++}`);
    params.push(filters.notification_type);
  }

  if (filters.priority) {
    conditions.push(`n.priority = $${paramIndex++}`);
    params.push(filters.priority);
  }

  if (filters.is_read !== undefined) {
    conditions.push(`n.is_read = $${paramIndex++}`);
    params.push(filters.is_read);
  }

  if (filters.related_entity_type) {
    conditions.push(`n.related_entity_type = $${paramIndex++}`);
    params.push(filters.related_entity_type);
  }

  if (filters.related_entity_id) {
    conditions.push(`n.related_entity_id = $${paramIndex++}`);
    params.push(filters.related_entity_id);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT
      n.*,
      COALESCE(univ.name, user_univ.name, a.location) AS university_name
    FROM notifications n
    LEFT JOIN admissions a
      ON n.related_entity_type = 'admission'
      AND n.related_entity_id = a.id
    LEFT JOIN universities univ
      ON univ.id = a.university_id
    LEFT JOIN users u
      ON u.id = a.created_by
    LEFT JOIN universities user_univ
      ON user_univ.id = u.university_id
    ${whereClause}
    ORDER BY n.${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}
