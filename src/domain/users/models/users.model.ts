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
import { User, UserFilters, CreateUserDTO, UpdateUserDTO, UniversityProfile, UpdateUniversityProfileDTO } from '../types/users.types';
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
      auth_user_id, role, display_name, university_id, status
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const params = [
    data.auth_user_id || null,
    data.role,
    data.display_name,
    data.university_id || null,
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
    university_id: data.university_id,
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

  // University ID filter
  if (filters.university_id) {
    conditions.push(`university_id = $${paramIndex++}`);
    params.push(filters.university_id);
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

  // University ID filter
  if (filters.university_id) {
    conditions.push(`university_id = $${paramIndex++}`);
    params.push(filters.university_id);
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

/**
 * Find university by ID
 * 
 * @param id - University UUID
 * @returns University profile or null if not found
 */
export const findUniversityById = async (id: string): Promise<UniversityProfile | null> => {
  const sql = 'SELECT * FROM universities WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Insert or update university profile
 * Uses UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
 * 
 * @param id - University UUID
 * @param data - University profile data to insert/update
 * @returns Updated university profile
 */
export const upsertUniversityProfile = async (
  id: string,
  data: UpdateUniversityProfileDTO
): Promise<UniversityProfile> => {
  // Build dynamic SET clause based on provided fields
  const updates: string[] = [];
  const params: any[] = [id];
  let paramIndex = 2;

  // Map DTO fields to database column names
  const fieldMapping = {
    name: 'name',
    city: 'city',
    country: 'country',
    website: 'website',
    logo_url: 'logo_url',
    description: 'description',
    address: 'address',
    contact_name: 'contact_name',
    contact_email: 'contact_email',
    contact_phone: 'contact_phone',
  };

  // Dynamically build UPDATE SET clause
  for (const [key, dbColumn] of Object.entries(fieldMapping)) {
    if (key in data && data[key as keyof UpdateUniversityProfileDTO] !== undefined) {
      updates.push(`${dbColumn} = $${paramIndex}`);
      params.push(data[key as keyof UpdateUniversityProfileDTO]);
      paramIndex++;
    }
  }

  // Always update the updated_at timestamp
  updates.push(`updated_at = NOW()`);

  if (updates.length === 1) {
    // Only updated_at, so just do a simple INSERT or UPDATE
    const sql = `
      INSERT INTO universities (id, updated_at) VALUES ($1, NOW())
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
      RETURNING *;
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  // Build the INSERT INTO clause with the fields being updated
  const insertFields = Object.values(fieldMapping).filter((_, idx) => {
    return idx < params.length - 1; // Exclude timestamp
  });

  const sql = `
    INSERT INTO universities (id, ${insertFields.join(', ')}, created_at, updated_at)
    VALUES ($1, ${Array.from({ length: paramIndex - 2 }, (_, i) => `$${i + 2}`).join(', ')}, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
    ${updates.join(', ')}
    RETURNING *;
  `;

  const result = await query(sql, params);
  return result.rows[0];
};
