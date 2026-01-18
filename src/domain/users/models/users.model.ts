/**
 * Users Domain - Model Layer
 * 
 * Database access layer for users.
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
import { User, UserFilters, CreateUserDTO, UpdateUserDTO } from '../types/users.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS } from '../constants/users.constants';

/**
 * Find user by ID
 * 
 * @param id - User UUID
 * @returns User record or null if not found
 */
export const findById = async (id: string): Promise<User | null> => {
  const sql = 'SELECT * FROM users WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Find user by auth_user_id (Supabase Auth UUID)
 * 
 * @param authUserId - Supabase Auth UUID
 * @returns User record or null if not found
 */
export const findByAuthUserId = async (authUserId: string): Promise<User | null> => {
  const sql = 'SELECT * FROM users WHERE auth_user_id = $1';
  const result = await query(sql, [authUserId]);
  return result.rows[0] || null;
};

/**
 * Count users matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching users
 */
export const count = async (filters: UserFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple users with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of user records
 */
export const findMany = async (
  filters: UserFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<User[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Create a new user
 * 
 * @param data - User data
 * @returns Created user record
 */
export const create = async (data: CreateUserDTO): Promise<User> => {
  const sql = `
    INSERT INTO users (
      auth_user_id, role, display_name, organization_id, status
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const params = [
    data.auth_user_id || null,
    data.role,
    data.display_name,
    data.organization_id || null,
    data.status || 'active',
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Update an existing user
 * 
 * @param id - User UUID
 * @param data - Partial user data to update
 * @returns Updated user record or null if not found
 */
export const update = async (
  id: string,
  data: UpdateUserDTO
): Promise<User | null> => {
  // Build dynamic UPDATE query based on provided fields
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Map of field names to their parameterized values
  const fieldMap: Record<string, any> = {
    display_name: data.display_name,
    organization_id: data.organization_id,
  };

  // Build SET clause for provided fields
  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${field} = $${paramIndex++}`);
      values.push(value);
    }
  }

  // If no fields to update, return null
  if (fields.length === 0) {
    return null;
  }

  // Add updated_at
  fields.push(`updated_at = NOW()`);

  // Add id parameter
  values.push(id);

  const sql = `
    UPDATE users
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await query(sql, values);
  return result.rows[0] || null;
};

/**
 * Update user role (admin only)
 * 
 * @param id - User UUID
 * @param role - New role
 * @returns Updated user record or null if not found
 */
export const updateRole = async (
  id: string,
  role: string
): Promise<User | null> => {
  const sql = `
    UPDATE users
    SET role = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await query(sql, [role, id]);
  return result.rows[0] || null;
};

/**
 * Update user status (admin only)
 * 
 * @param id - User UUID
 * @param status - New status
 * @returns Updated user record or null if not found
 */
export const updateStatus = async (
  id: string,
  status: 'active' | 'suspended'
): Promise<User | null> => {
  const sql = `
    UPDATE users
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;

  const result = await query(sql, [status, id]);
  return result.rows[0] || null;
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: UserFilters): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Role filter
  if (filters.role) {
    if (Array.isArray(filters.role)) {
      const placeholders = filters.role.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`role IN (${placeholders})`);
      params.push(...filters.role);
    } else {
      conditions.push(`role = $${paramIndex++}`);
      params.push(filters.role);
    }
  }

  // Status filter
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  // Organization ID filter
  if (filters.organization_id) {
    conditions.push(`organization_id = $${paramIndex++}`);
    params.push(filters.organization_id);
  }

  // Auth user ID filter
  if (filters.auth_user_id) {
    conditions.push(`auth_user_id = $${paramIndex++}`);
    params.push(filters.auth_user_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM users ${whereClause}`;

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
  filters: UserFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number
): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Role filter
  if (filters.role) {
    if (Array.isArray(filters.role)) {
      const placeholders = filters.role.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`role IN (${placeholders})`);
      params.push(...filters.role);
    } else {
      conditions.push(`role = $${paramIndex++}`);
      params.push(filters.role);
    }
  }

  // Status filter
  if (filters.status) {
    conditions.push(`status = $${paramIndex++}`);
    params.push(filters.status);
  }

  // Organization ID filter
  if (filters.organization_id) {
    conditions.push(`organization_id = $${paramIndex++}`);
    params.push(filters.organization_id);
  }

  // Auth user ID filter
  if (filters.auth_user_id) {
    conditions.push(`auth_user_id = $${paramIndex++}`);
    params.push(filters.auth_user_id);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM users
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}
