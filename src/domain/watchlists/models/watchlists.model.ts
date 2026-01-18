/**
 * Watchlists Domain - Model Layer
 * 
 * Database access layer for watchlists.
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
import { Watchlist, WatchlistFilters, CreateWatchlistDTO, UpdateWatchlistDTO } from '../types/watchlists.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS } from '../constants/watchlists.constants';

/**
 * Find watchlist by ID
 * 
 * @param id - Watchlist UUID
 * @returns Watchlist record or null if not found
 */
export const findById = async (id: string): Promise<Watchlist | null> => {
  const sql = 'SELECT * FROM watchlists WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Find watchlist by user and admission
 * 
 * @param userId - User UUID
 * @param admissionId - Admission UUID
 * @returns Watchlist record or null if not found
 */
export const findByUserAndAdmission = async (
  userId: string,
  admissionId: string
): Promise<Watchlist | null> => {
  const sql = 'SELECT * FROM watchlists WHERE user_id = $1 AND admission_id = $2';
  const result = await query(sql, [userId, admissionId]);
  return result.rows[0] || null;
};

/**
 * Count watchlists matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching watchlists
 */
export const count = async (filters: WatchlistFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple watchlists with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of watchlist records
 */
export const findMany = async (
  filters: WatchlistFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<Watchlist[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Create a new watchlist item
 * 
 * @param data - Watchlist data
 * @returns Created watchlist record
 */
export const create = async (data: CreateWatchlistDTO & { user_id: string }): Promise<Watchlist> => {
  const sql = `
    INSERT INTO watchlists (user_id, admission_id, notes)
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const params = [
    data.user_id,
    data.admission_id,
    data.notes || null,
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Create or get existing watchlist (idempotent)
 * 
 * @param data - Watchlist data
 * @returns Created or existing watchlist record
 */
export const createOrGet = async (
  data: CreateWatchlistDTO & { user_id: string }
): Promise<Watchlist> => {
  // Try to find existing
  const existing = await findByUserAndAdmission(data.user_id, data.admission_id);
  if (existing) {
    return existing;
  }

  // Create new
  try {
    return await create(data);
  } catch (error: any) {
    // If unique constraint violation, fetch existing
    if (error.code === '23505') {
      const existing = await findByUserAndAdmission(data.user_id, data.admission_id);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
};

/**
 * Update watchlist item
 * 
 * @param id - Watchlist UUID
 * @param data - Update data
 * @returns Updated watchlist record or null if not found
 */
export const update = async (
  id: string,
  data: UpdateWatchlistDTO
): Promise<Watchlist | null> => {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`);
    params.push(data.notes);
  }

  if (updates.length === 0) {
    // No updates, return existing
    return findById(id);
  }

  updates.push(`updated_at = NOW()`);
  params.push(id);

  const sql = `
    UPDATE watchlists
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await query(sql, params);
  return result.rows[0] || null;
};

/**
 * Delete watchlist item
 * 
 * @param id - Watchlist UUID
 * @returns True if deleted, false if not found
 */
export const deleteById = async (id: string): Promise<boolean> => {
  const sql = 'DELETE FROM watchlists WHERE id = $1';
  const result = await query(sql, [id]);
  return (result.rowCount || 0) > 0;
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: WatchlistFilters): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // User ID filter (required)
  conditions.push(`user_id = $${paramIndex++}`);
  params.push(filters.user_id);

  // Admission ID filter
  if (filters.admission_id) {
    conditions.push(`admission_id = $${paramIndex++}`);
    params.push(filters.admission_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM watchlists ${whereClause}`;

  return { sql, params };
}

/**
 * Build FIND MANY query with filters, sorting, and pagination
 * 
 * @param filters - Filter criteria
 * @param sort - Sort field
 * @param order - Sort order
 * @param limit - Items per page
 * @param offset - Offset for pagination
 * @returns SQL query and parameters
 */
function buildFindManyQuery(
  filters: WatchlistFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number
): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // User ID filter (required)
  conditions.push(`user_id = $${paramIndex++}`);
  params.push(filters.user_id);

  // Admission ID filter
  if (filters.admission_id) {
    conditions.push(`admission_id = $${paramIndex++}`);
    params.push(filters.admission_id);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT *
    FROM watchlists
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  params.push(limit, offset);

  return { sql, params };
}
