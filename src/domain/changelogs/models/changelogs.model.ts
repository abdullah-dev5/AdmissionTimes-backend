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

type ViewerScope = { role: 'admin' | 'university'; universityId?: string };

const addUniversityScopeCondition = (
  conditions: string[],
  params: any[],
  paramIndex: number,
  scope?: ViewerScope,
  changelogAlias: string = 'c'
): number => {
  if (scope?.role === 'university' && scope.universityId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM admissions a
        WHERE a.id = ${changelogAlias}.admission_id
          AND (
            a.university_id::text = $${paramIndex}
            OR (
              a.university_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM users uo
                WHERE uo.id = a.created_by
                  AND uo.university_id::text = $${paramIndex}
              )
            )
          )
      )
    `);
    params.push(scope.universityId);
    return paramIndex + 1;
  }
  return paramIndex;
};

/**
 * Find changelog by ID
 * 
 * @param id - Changelog UUID
 * @returns Changelog record or null if not found
 */
export const findById = async (id: string, scope?: ViewerScope): Promise<Changelog | null> => {
  const conditions: string[] = ['c.id = $1'];
  const params: any[] = [id];
  addUniversityScopeCondition(conditions, params, 2, scope, 'c');

  const sql = `
    SELECT c.*
    FROM changelogs c
    WHERE ${conditions.join(' AND ')}
    LIMIT 1
  `;

  const result = await query(sql, params);
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
  order: 'asc' | 'desc' = 'desc',
  scope?: ViewerScope
): Promise<(Changelog & { program_title?: string })[]> => {
  const offset = calculateOffset(page, limit);
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const conditions: string[] = ['c.admission_id = $1'];
  const params: any[] = [admissionId];
  let paramIndex = 2;
  paramIndex = addUniversityScopeCondition(conditions, params, paramIndex, scope, 'c');

  const sql = `
    SELECT 
      c.*,
      a.title as program_title,
      a.title as admission_title,
      u.display_name as changed_by_name,
      c.created_at::text as changed_at_iso,
      CASE
        WHEN c.actor_type = 'admin' THEN 'Admin Edit'
        WHEN c.actor_type = 'system' THEN 'Scraper Update'
        ELSE 'Manual Edit'
      END as change_type,
      COALESCE(
        NULLIF(u.display_name, ''),
        CASE
          WHEN c.actor_type = 'admin' THEN 'Administrator'
          WHEN c.actor_type = 'university' THEN 'University Representative'
          WHEN c.actor_type = 'system' THEN 'Automated import'
          ELSE 'System'
        END
      ) as modified_by
    FROM changelogs c
    LEFT JOIN admissions a ON c.admission_id = a.id
    LEFT JOIN users u ON c.changed_by = u.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY c.${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  params.push(limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Count changelogs by admission ID
 * 
 * @param admissionId - Admission UUID
 * @returns Total count
 */
export const countByAdmissionId = async (admissionId: string, scope?: ViewerScope): Promise<number> => {
  const conditions: string[] = ['c.admission_id = $1'];
  const params: any[] = [admissionId];
  addUniversityScopeCondition(conditions, params, 2, scope, 'c');

  const sql = `SELECT COUNT(*) as count FROM changelogs c WHERE ${conditions.join(' AND ')}`;
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Count changelogs matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching changelogs
 */
export const count = async (filters: ChangelogFilters, scope?: ViewerScope): Promise<number> => {
  const { sql, params } = buildCountQuery(filters, scope);
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
  order: 'asc' | 'desc' = 'desc',
  scope?: ViewerScope
): Promise<(Changelog & { program_title?: string })[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset, scope);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * WHERE clause shared by the list and count queries, so totals always match
 * the rows a viewer can page through. Expects `c` (changelogs) and `a`
 * (admissions, LEFT JOINed) in scope.
 */
function buildWhere(filters: ChangelogFilters, scope?: ViewerScope): { where: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const addList = (column: string, value: string | string[]) => {
    const values = Array.isArray(value) ? value : [value];
    conditions.push(`${column} IN (${values.map((v) => add(v)).join(', ')})`);
  };

  if (filters.admission_id) conditions.push(`c.admission_id = ${add(filters.admission_id)}`);
  if (filters.actor_type) addList('c.actor_type', filters.actor_type as string | string[]);
  if (filters.action_type) addList('c.action_type', filters.action_type as string | string[]);
  if (filters.changed_by) conditions.push(`c.changed_by = ${add(filters.changed_by)}`);
  if (filters.date_from) conditions.push(`c.created_at >= ${add(filters.date_from)}`);
  if (filters.date_to) conditions.push(`c.created_at <= ${add(filters.date_to)}`);
  if (filters.search) {
    // Program title, field and summary (the pages search by program name).
    const term = add(`%${filters.search}%`);
    conditions.push(`(a.title ILIKE ${term} OR c.diff_summary ILIKE ${term} OR c.field_name ILIKE ${term})`);
  }

  addUniversityScopeCondition(conditions, params, params.length + 1, scope, 'c');

  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function buildCountQuery(filters: ChangelogFilters, scope?: ViewerScope): { sql: string; params: any[] } {
  const { where, params } = buildWhere(filters, scope);
  return {
    sql: `SELECT COUNT(*) as count FROM changelogs c LEFT JOIN admissions a ON a.id = c.admission_id ${where}`,
    params,
  };
}

function buildFindManyQuery(
  filters: ChangelogFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number,
  scope?: ViewerScope
): { sql: string; params: any[] } {
  const { where, params } = buildWhere(filters, scope);
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'created_at';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  params.push(limit, offset);

  const sql = `
    SELECT
      c.*,
      a.title as program_title,
      a.title as admission_title,
      u.display_name as changed_by_name,
      c.created_at::text as changed_at_iso,
      CASE
        WHEN c.actor_type = 'admin' THEN 'Admin Edit'
        WHEN c.actor_type = 'system' THEN 'Scraper Update'
        ELSE 'Manual Edit'
      END as change_type,
      COALESCE(
        NULLIF(u.display_name, ''),
        CASE
          WHEN c.actor_type = 'admin' THEN 'Administrator'
          WHEN c.actor_type = 'university' THEN 'University Representative'
          WHEN c.actor_type = 'system' THEN 'Automated import'
          ELSE 'System'
        END
      ) as modified_by
    FROM changelogs c
    LEFT JOIN admissions a ON c.admission_id = a.id
    LEFT JOIN users u ON c.changed_by = u.id
    ${where}
    ORDER BY c.${sortField} ${sortOrder}, c.id
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  return { sql, params };
}

export interface ChangelogSummary {
  total: number;
  by_actor: { admin: number; university: number; system: number };
  reviews: number;
  today: number;
  last_7_days: number;
}

/** Counts for the change-log pages (all entries the viewer may see, not one page). */
export const getSummary = async (scope?: ViewerScope): Promise<ChangelogSummary> => {
  const { where, params } = buildWhere({} as ChangelogFilters, scope);
  const result = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE c.actor_type = 'admin')::int AS admin,
       COUNT(*) FILTER (WHERE c.actor_type = 'university')::int AS university,
       COUNT(*) FILTER (WHERE c.actor_type = 'system')::int AS system,
       COUNT(*) FILTER (WHERE c.actor_type = 'admin' AND c.action_type IN ('verified', 'rejected', 'status_changed'))::int AS reviews,
       -- "Today" is the Pakistan calendar day, like everywhere else in the app.
       COUNT(*) FILTER (WHERE c.created_at >= (date_trunc('day', NOW() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi'))::int AS today,
       COUNT(*) FILTER (WHERE c.created_at >= NOW() - INTERVAL '7 days')::int AS last_7_days
     FROM changelogs c
     LEFT JOIN admissions a ON a.id = c.admission_id
     ${where}`,
    params
  );
  const row = result.rows[0] || {};
  return {
    total: row.total || 0,
    by_actor: { admin: row.admin || 0, university: row.university || 0, system: row.system || 0 },
    reviews: row.reviews || 0,
    today: row.today || 0,
    last_7_days: row.last_7_days || 0,
  };
};
