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
