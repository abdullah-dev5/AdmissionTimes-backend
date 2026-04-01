/**
 * User Activity Domain - Model Layer
 * 
 * Database access layer for user activity.
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
import { UserActivity, UserActivityFilters, CreateUserActivityDTO } from '../types/user-activity.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS } from '../constants/user-activity.constants';
import { ACTIVITY_TYPE } from '@config/constants';

/**
 * Find user activity by ID
 * 
 * @param id - Activity UUID
 * @returns Activity record or null if not found
 */
export const findById = async (id: string): Promise<UserActivity | null> => {
  const sql = 'SELECT * FROM user_activity WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Count activities matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching activities
 */
export const count = async (filters: UserActivityFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple activities with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of activity records
 */
export const findMany = async (
  filters: UserActivityFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<UserActivity[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Create a new activity record
 * 
 * @param data - Activity data
 * @returns Created activity record
 */
export const create = async (data: CreateUserActivityDTO): Promise<UserActivity> => {
  const sql = `
    INSERT INTO user_activity (
      user_id, user_type, activity_type, entity_type, entity_id, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const params = [
    data.user_id || null,
    data.user_type,
    data.activity_type,
    data.entity_type,
    data.entity_id,
    data.metadata ? JSON.stringify(data.metadata) : null,
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Find existing capped activity for student+admission combinations.
 *
 * Cap rules:
 * - one viewed event per student per admission
 * - one click-group event (searched|compared|alert) per student per admission
 */
export const findExistingCappedStudentAdmissionActivity = async (
  userId: string,
  entityId: string,
  activityType: CreateUserActivityDTO['activity_type']
): Promise<UserActivity | null> => {
  const clickGroup = [ACTIVITY_TYPE.SEARCHED, ACTIVITY_TYPE.COMPARED, ACTIVITY_TYPE.ALERT];

  const sql = `
    SELECT *
    FROM user_activity
    WHERE user_id = $1
      AND user_type = 'student'
      AND entity_type = 'admission'
      AND entity_id = $2
      AND (
        ($3 = '${ACTIVITY_TYPE.VIEWED}' AND activity_type = '${ACTIVITY_TYPE.VIEWED}')
        OR
        ($3 = ANY($4::text[]) AND activity_type = ANY($4::text[]))
      )
    ORDER BY created_at ASC
    LIMIT 1
  `;

  const result = await query(sql, [userId, entityId, activityType, clickGroup]);
  return result.rows[0] || null;
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: UserActivityFilters): { sql: string; params: any[] } {
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

  // Activity type filter
  if (filters.activity_type) {
    conditions.push(`activity_type = $${paramIndex++}`);
    params.push(filters.activity_type);
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM user_activity ${whereClause}`;
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
  filters: UserActivityFilters,
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

  if (filters.activity_type) {
    conditions.push(`activity_type = $${paramIndex++}`);
    params.push(filters.activity_type);
  }

  if (filters.entity_type) {
    conditions.push(`entity_type = $${paramIndex++}`);
    params.push(filters.entity_type);
  }

  if (filters.entity_id) {
    conditions.push(`entity_id = $${paramIndex++}`);
    params.push(filters.entity_id);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM user_activity
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}
