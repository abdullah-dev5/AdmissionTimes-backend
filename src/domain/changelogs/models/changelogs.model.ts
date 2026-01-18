/**
 * Changelogs Domain - Model Layer
 * 
 * Database access layer for changelogs.
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
import { Changelog, ChangelogFilters } from '../types/changelogs.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS } from '../constants/changelogs.constants';

/**
 * Find changelog by ID
 * 
 * @param id - Changelog UUID
 * @returns Changelog record or null if not found
 */
export const findById = async (id: string): Promise<Changelog | null> => {
  const sql = 'SELECT * FROM changelogs WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Find changelogs by admission ID
 * 
 * @param admissionId - Admission UUID
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of changelog records
 */
export const findByAdmissionId = async (
  admissionId: string,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<Changelog[]> => {
  const offset = calculateOffset(page, limit);
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const sql = `
    SELECT * FROM changelogs
    WHERE admission_id = $1
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $2 OFFSET $3
  `;

  const result = await query(sql, [admissionId, limit, offset]);
  return result.rows;
};

/**
 * Count changelogs by admission ID
 * 
 * @param admissionId - Admission UUID
 * @returns Total count
 */
export const countByAdmissionId = async (admissionId: string): Promise<number> => {
  const sql = 'SELECT COUNT(*) as count FROM changelogs WHERE admission_id = $1';
  const result = await query(sql, [admissionId]);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Count changelogs matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching changelogs
 */
export const count = async (filters: ChangelogFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple changelogs with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of changelog records
 */
export const findMany = async (
  filters: ChangelogFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<Changelog[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: ChangelogFilters): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Admission ID filter
  if (filters.admission_id) {
    conditions.push(`admission_id = $${paramIndex++}`);
    params.push(filters.admission_id);
  }

  // Actor type filter
  if (filters.actor_type) {
    if (Array.isArray(filters.actor_type)) {
      const placeholders = filters.actor_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`actor_type IN (${placeholders})`);
      params.push(...filters.actor_type);
    } else {
      conditions.push(`actor_type = $${paramIndex++}`);
      params.push(filters.actor_type);
    }
  }

  // Action type filter
  if (filters.action_type) {
    if (Array.isArray(filters.action_type)) {
      const placeholders = filters.action_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`action_type IN (${placeholders})`);
      params.push(...filters.action_type);
    } else {
      conditions.push(`action_type = $${paramIndex++}`);
      params.push(filters.action_type);
    }
  }

  // Changed by filter
  if (filters.changed_by) {
    conditions.push(`changed_by = $${paramIndex++}`);
    params.push(filters.changed_by);
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

  // Search filter (case-insensitive search in diff_summary)
  if (filters.search) {
    conditions.push(`LOWER(diff_summary) LIKE LOWER($${paramIndex++})`);
    params.push(`%${filters.search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM changelogs ${whereClause}`;

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
  filters: ChangelogFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number
): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Admission ID filter
  if (filters.admission_id) {
    conditions.push(`admission_id = $${paramIndex++}`);
    params.push(filters.admission_id);
  }

  // Actor type filter
  if (filters.actor_type) {
    if (Array.isArray(filters.actor_type)) {
      const placeholders = filters.actor_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`actor_type IN (${placeholders})`);
      params.push(...filters.actor_type);
    } else {
      conditions.push(`actor_type = $${paramIndex++}`);
      params.push(filters.actor_type);
    }
  }

  // Action type filter
  if (filters.action_type) {
    if (Array.isArray(filters.action_type)) {
      const placeholders = filters.action_type.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`action_type IN (${placeholders})`);
      params.push(...filters.action_type);
    } else {
      conditions.push(`action_type = $${paramIndex++}`);
      params.push(filters.action_type);
    }
  }

  // Changed by filter
  if (filters.changed_by) {
    conditions.push(`changed_by = $${paramIndex++}`);
    params.push(filters.changed_by);
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

  // Search filter (case-insensitive search in diff_summary)
  if (filters.search) {
    conditions.push(`LOWER(diff_summary) LIKE LOWER($${paramIndex++})`);
    params.push(`%${filters.search}%`);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM changelogs
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}
