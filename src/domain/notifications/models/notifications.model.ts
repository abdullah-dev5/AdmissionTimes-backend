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
  const sql = `
    INSERT INTO notifications (
      user_id, user_type, category, priority, title, message,
      related_entity_type, related_entity_id, action_url, is_read
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

  const params = [
    data.user_id || null,
    data.user_type,
    data.category,
    data.priority || DEFAULTS.PRIORITY,
    data.title,
    data.message,
    data.related_entity_type || null,
    data.related_entity_id || null,
    data.action_url || null,
    DEFAULTS.IS_READ,
  ];

  const result = await query(sql, params);
  return result.rows[0];
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
  userId: string | null,
  userType: string
): Promise<number> => {
  let sql: string;
  let params: any[];

  if (userId) {
    sql = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND user_type = $2 AND is_read = false
    `;
    params = [userId, userType];
  } else {
    sql = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id IS NULL AND user_type = $1 AND is_read = false
    `;
    params = [userType];
  }

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
  userId: string | null,
  userType: string
): Promise<number> => {
  let sql: string;
  let params: any[];

  if (userId) {
    sql = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND user_type = $2 AND is_read = false
    `;
    params = [userId, userType];
  } else {
    sql = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id IS NULL AND user_type = $1 AND is_read = false
    `;
    params = [userType];
  }

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
  if (filters.user_id !== undefined) {
    if (filters.user_id === null) {
      conditions.push('user_id IS NULL');
    } else {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.user_id);
    }
  }

  // User type filter
  if (filters.user_type) {
    conditions.push(`user_type = $${paramIndex++}`);
    params.push(filters.user_type);
  }

  // Category filter
  if (filters.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(filters.category);
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
  if (filters.user_id !== undefined) {
    if (filters.user_id === null) {
      conditions.push('user_id IS NULL');
    } else {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.user_id);
    }
  }

  if (filters.user_type) {
    conditions.push(`user_type = $${paramIndex++}`);
    params.push(filters.user_type);
  }

  if (filters.category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(filters.category);
  }

  if (filters.priority) {
    conditions.push(`priority = $${paramIndex++}`);
    params.push(filters.priority);
  }

  if (filters.is_read !== undefined) {
    conditions.push(`is_read = $${paramIndex++}`);
    params.push(filters.is_read);
  }

  if (filters.related_entity_type) {
    conditions.push(`related_entity_type = $${paramIndex++}`);
    params.push(filters.related_entity_type);
  }

  if (filters.related_entity_id) {
    conditions.push(`related_entity_id = $${paramIndex++}`);
    params.push(filters.related_entity_id);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM notifications
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}
