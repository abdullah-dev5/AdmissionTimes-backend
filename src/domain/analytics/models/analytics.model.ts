/**
 * Analytics Domain - Model Layer
 * 
 * Database access layer for analytics events.
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
import { AnalyticsEvent, CreateAnalyticsEventDTO, AnalyticsEventFilters } from '../types/analytics.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS } from '../constants/analytics.constants';

/**
 * Create a new analytics event
 * 
 * @param data - Event data
 * @returns Created event record
 */
export const create = async (data: CreateAnalyticsEventDTO): Promise<AnalyticsEvent> => {
  const sql = `
    INSERT INTO analytics_events (
      event_type, entity_type, entity_id, user_type, user_id, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const params = [
    data.event_type,
    data.entity_type || null,
    data.entity_id || null,
    data.user_type || null,
    data.user_id || null,
    data.metadata ? JSON.stringify(data.metadata) : null,
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Find event by ID
 * 
 * @param id - Event UUID
 * @returns Event record or null if not found
 */
export const findById = async (id: string): Promise<AnalyticsEvent | null> => {
  const sql = 'SELECT * FROM analytics_events WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Count events matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching events
 */
export const count = async (filters: AnalyticsEventFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple events with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of event records
 */
export const findMany = async (
  filters: AnalyticsEventFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<AnalyticsEvent[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Get general statistics
 * 
 * @returns General statistics object
 */
export const getGeneralStatistics = async (): Promise<any> => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM analytics_events) as total_events,
      (SELECT COUNT(*) FROM admissions WHERE is_active = true) as total_admissions,
      (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users,
      (SELECT COUNT(*) FROM analytics_events WHERE created_at >= CURRENT_DATE) as events_today,
      (SELECT COUNT(*) FROM analytics_events WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as events_this_week,
      (SELECT COUNT(*) FROM analytics_events WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as events_this_month
  `;
  const result = await query(sql);
  return result.rows[0];
};

/**
 * Get events by type count
 * 
 * @returns Object with event_type as key and count as value
 */
export const getEventsByType = async (): Promise<Record<string, number>> => {
  const sql = `
    SELECT event_type, COUNT(*) as count
    FROM analytics_events
    GROUP BY event_type
  `;
  const result = await query(sql);
  const eventsByType: Record<string, number> = {};
  result.rows.forEach((row: any) => {
    eventsByType[row.event_type] = parseInt(row.count, 10);
  });
  return eventsByType;
};

/**
 * Get admission statistics
 * 
 * @returns Admission statistics object
 */
export const getAdmissionStatistics = async (): Promise<any> => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM admissions WHERE is_active = true) as total_admissions,
      (SELECT COUNT(*) FROM admissions WHERE verification_status = 'verified' AND is_active = true) as verified_count,
      (SELECT COUNT(*) FROM admissions WHERE verification_status = 'rejected' AND is_active = true) as rejected_count,
      (SELECT COUNT(*) FROM admissions WHERE verification_status = 'pending' AND is_active = true) as pending_count,
      (SELECT COUNT(*) FROM admissions WHERE verification_status = 'draft' AND is_active = true) as draft_count,
      (SELECT COUNT(*) FROM admissions WHERE created_at >= CURRENT_DATE AND is_active = true) as created_today,
      (SELECT COUNT(*) FROM admissions WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND is_active = true) as created_this_week,
      (SELECT COUNT(*) FROM admissions WHERE created_at >= CURRENT_DATE - INTERVAL '30 days' AND is_active = true) as created_this_month
  `;
  const result = await query(sql);
  return result.rows[0];
};

/**
 * Get user statistics
 * 
 * @returns User statistics object
 */
export const getUserStatistics = async (): Promise<any> => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM users) as total_users,
      (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
      (SELECT COUNT(*) FROM users WHERE status = 'suspended') as suspended_users,
      (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE) as created_today,
      (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as created_this_week,
      (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as created_this_month
  `;
  const result = await query(sql);
  return result.rows[0];
};

/**
 * Get users by role count
 * 
 * @returns Object with role as key and count as value
 */
export const getUsersByRole = async (): Promise<Record<string, number>> => {
  const sql = `
    SELECT role, COUNT(*) as count
    FROM users
    GROUP BY role
  `;
  const result = await query(sql);
  const usersByRole: Record<string, number> = {};
  result.rows.forEach((row: any) => {
    usersByRole[row.role] = parseInt(row.count, 10);
  });
  return usersByRole;
};

/**
 * Get aggregated activity feed
 * 
 * @param limit - Maximum number of items to return
 * @returns Array of aggregated activity items
 */
export const getActivityFeed = async (limit: number = 20): Promise<any[]> => {
  const sql = `
    SELECT 
      event_type,
      entity_type,
      entity_id,
      COUNT(*) as count,
      MAX(created_at) as last_occurred_at
    FROM analytics_events
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY event_type, entity_type, entity_id
    ORDER BY last_occurred_at DESC
    LIMIT $1
  `;
  const result = await query(sql, [limit]);
  return result.rows;
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: AnalyticsEventFilters): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Event type filter
  if (filters.event_type) {
    if (Array.isArray(filters.event_type)) {
      const placeholders = filters.event_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`event_type IN (${placeholders})`);
      params.push(...filters.event_type);
    } else {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(filters.event_type);
    }
  }

  // Entity type filter
  if (filters.entity_type) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(filters.entity_type);
  }

  // Entity ID filter
  if (filters.entity_id) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(filters.entity_id);
  }

  // User type filter
  if (filters.user_type) {
    if (Array.isArray(filters.user_type)) {
      const placeholders = filters.user_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`user_type IN (${placeholders})`);
      params.push(...filters.user_type);
    } else {
      conditions.push(`user_type = $${paramIndex++}`);
      params.push(filters.user_type);
    }
  }

  // User ID filter
  if (filters.user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.user_id);
  }

  // Date range filters
  if (filters.date_from) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.date_to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM analytics_events ${whereClause}`;

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
  filters: AnalyticsEventFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number
): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Event type filter
  if (filters.event_type) {
    if (Array.isArray(filters.event_type)) {
      const placeholders = filters.event_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`event_type IN (${placeholders})`);
      params.push(...filters.event_type);
    } else {
      conditions.push(`event_type = $${paramIndex++}`);
      params.push(filters.event_type);
    }
  }

  // Entity type filter
  if (filters.entity_type) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(filters.entity_type);
  }

  // Entity ID filter
  if (filters.entity_id) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(filters.entity_id);
  }

  // User type filter
  if (filters.user_type) {
    if (Array.isArray(filters.user_type)) {
      const placeholders = filters.user_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`user_type IN (${placeholders})`);
      params.push(...filters.user_type);
    } else {
      conditions.push(`user_type = $${paramIndex++}`);
      params.push(filters.user_type);
    }
  }

  // User ID filter
  if (filters.user_id) {
    conditions.push(`user_id = $${paramIndex++}`);
    params.push(filters.user_id);
  }

  // Date range filters
  if (filters.date_from) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.date_to);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM analytics_events
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}
