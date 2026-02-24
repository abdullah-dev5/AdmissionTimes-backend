/**
 * Deadlines Domain - Model Layer
 * 
 * Database access layer for deadlines.
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
import { Deadline, DeadlineFilters, CreateDeadlineDTO, UpdateDeadlineDTO } from '../types/deadlines.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS } from '../constants/deadlines.constants';
import { DEFAULTS } from '../constants/deadlines.constants';

export interface DeadlineReminderTarget {
  deadline_id: string;
  deadline_type: string;
  deadline_date: string;
  admission_id: string;
  admission_title: string;
  recipient_id: string;
}

/**
 * Find deadline by ID
 * 
 * @param id - Deadline UUID
 * @returns Deadline record or null if not found
 */
export const findById = async (id: string): Promise<Deadline | null> => {
  const sql = 'SELECT * FROM deadlines WHERE id = $1';
  const result = await query(sql, [id]);
  return result.rows[0] || null;
};

/**
 * Find deadlines by admission ID
 * 
 * @param admissionId - Admission UUID
 * @returns Array of deadline records
 */
export const findByAdmissionId = async (admissionId: string): Promise<Deadline[]> => {
  const sql = 'SELECT * FROM deadlines WHERE admission_id = $1 ORDER BY deadline_date ASC';
  const result = await query(sql, [admissionId]);
  return result.rows;
};

/**
 * Count deadlines matching filters
 * 
 * @param filters - Filter criteria
 * @returns Total count of matching deadlines
 */
export const count = async (filters: DeadlineFilters): Promise<number> => {
  const { sql, params } = buildCountQuery(filters);
  const result = await query(sql, params);
  return parseInt(result.rows[0].count, 10);
};

/**
 * Find multiple deadlines with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param sort - Field to sort by
 * @param order - Sort order ('asc' or 'desc')
 * @returns Array of deadline records
 */
export const findMany = async (
  filters: DeadlineFilters,
  page: number,
  limit: number,
  sort: string = 'deadline_date',
  order: 'asc' | 'desc' = 'asc'
): Promise<Deadline[]> => {
  const offset = calculateOffset(page, limit);
  const { sql, params } = buildFindManyQuery(filters, sort, order, limit, offset);
  const result = await query(sql, params);
  return result.rows;
};

/**
 * Find upcoming deadlines
 * 
 * @param limit - Maximum number of deadlines to return
 * @returns Array of upcoming deadline records
 */
export const findUpcoming = async (limit: number = 10): Promise<Deadline[]> => {
  const sql = `
    SELECT * FROM deadlines
    WHERE deadline_date > NOW()
    ORDER BY deadline_date ASC
    LIMIT $1
  `;
  const result = await query(sql, [limit]);
  return result.rows;
};

/**
 * Create a new deadline
 * 
 * @param data - Deadline data
 * @returns Created deadline record
 */
export const create = async (data: CreateDeadlineDTO): Promise<Deadline> => {
  const sql = `
    INSERT INTO deadlines (
      admission_id, deadline_type, deadline_date, timezone, is_flexible
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const params = [
    data.admission_id,
    data.deadline_type,
    data.deadline_date,
    data.timezone || DEFAULTS.TIMEZONE,
    data.is_flexible ?? DEFAULTS.IS_FLEXIBLE,
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Update an existing deadline
 * 
 * @param id - Deadline UUID
 * @param data - Partial deadline data to update
 * @returns Updated deadline record or null if not found
 */
export const update = async (
  id: string,
  data: UpdateDeadlineDTO
): Promise<Deadline | null> => {
  // Build dynamic UPDATE query based on provided fields
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Map of field names to their parameterized values
  const fieldMap: Record<string, any> = {
    deadline_type: data.deadline_type,
    deadline_date: data.deadline_date,
    timezone: data.timezone,
    is_flexible: data.is_flexible,
    reminder_sent: data.reminder_sent,
  };

  // Build SET clause dynamically
  for (const [field, value] of Object.entries(fieldMap)) {
    if (value !== undefined) {
      fields.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  // If no fields to update, return existing
  if (fields.length === 0) {
    return await findById(id);
  }

  // Add id parameter
  values.push(id);

  const sql = `
    UPDATE deadlines
    SET ${fields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await query(sql, values);
  return result.rows[0] || null;
};

/**
 * Build COUNT query with filters
 * 
 * @param filters - Filter criteria
 * @returns SQL query and parameters
 */
function buildCountQuery(filters: DeadlineFilters): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Admission ID filter
  if (filters.admission_id) {
    conditions.push(`admission_id = $${paramIndex++}`);
    params.push(filters.admission_id);
  }

  // Deadline type filter
  if (filters.deadline_type) {
    conditions.push(`deadline_type = $${paramIndex++}`);
    params.push(filters.deadline_type);
  }

  // Overdue filter
  if (filters.is_overdue !== undefined) {
    if (filters.is_overdue) {
      conditions.push(`deadline_date < NOW()`);
    } else {
      conditions.push(`deadline_date >= NOW()`);
    }
  }

  // Upcoming filter
  if (filters.is_upcoming !== undefined) {
    if (filters.is_upcoming) {
      conditions.push(`deadline_date > NOW()`);
    }
  }

  // Date range filters
  if (filters.date_from) {
    conditions.push(`deadline_date >= $${paramIndex++}`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    conditions.push(`deadline_date <= $${paramIndex++}`);
    params.push(filters.date_to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) as count FROM deadlines ${whereClause}`;
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
  filters: DeadlineFilters,
  sort: string,
  order: 'asc' | 'desc',
  limit: number,
  offset: number
): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Apply same filters as count query
  if (filters.admission_id) {
    conditions.push(`admission_id = $${paramIndex++}`);
    params.push(filters.admission_id);
  }

  if (filters.deadline_type) {
    conditions.push(`deadline_type = $${paramIndex++}`);
    params.push(filters.deadline_type);
  }

  if (filters.is_overdue !== undefined) {
    if (filters.is_overdue) {
      conditions.push(`deadline_date < NOW()`);
    } else {
      conditions.push(`deadline_date >= NOW()`);
    }
  }

  if (filters.is_upcoming !== undefined) {
    if (filters.is_upcoming) {
      conditions.push(`deadline_date > NOW()`);
    }
  }

  if (filters.date_from) {
    conditions.push(`deadline_date >= $${paramIndex++}`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    conditions.push(`deadline_date <= $${paramIndex++}`);
    params.push(filters.date_to);
  }

  // Validate sort field
  const sortField = SORTABLE_FIELDS.includes(sort as any) ? sort : 'deadline_date';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Add pagination parameters
  params.push(limit, offset);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT * FROM deadlines
    ${whereClause}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `;

  return { sql, params };
}

/**
 * Find user's upcoming deadlines with admission and university details
 * Uses watchlist to determine which admissions are relevant to the user
 * 
 * @param userId - User UUID
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param lookAheadDays - Number of days in future to look
 * @param alertOptInOnly - Only return deadlines where user has alerts enabled
 * @returns Array of deadline records with related data
 */
export const findUserUpcomingDeadlines = async (
  userId: string,
  page: number,
  limit: number,
  lookAheadDays: number = 7,
  alertOptInOnly: boolean = true
): Promise<any[]> => {
  const offset = calculateOffset(page, limit);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + lookAheadDays);
  
  const now = new Date().toISOString();
  const future = futureDate.toISOString();
  
  const sql = `
    SELECT DISTINCT
      d.*,
      a.title as admission_title,
      a.id as admission_id,
      u.name as university_name,
      u.logo_url as university_logo,
      w.id as watchlist_id,
      w.alert_opt_in,
      EXTRACT(DAY FROM (d.deadline_date::timestamp - NOW())) as days_remaining
    FROM watchlists w
    JOIN admissions a ON w.admission_id = a.id
    JOIN deadlines d ON a.id = d.admission_id
    LEFT JOIN universities u ON a.university_id = u.id
    WHERE w.user_id = $1
      AND d.deadline_date >= $2
      AND d.deadline_date <= $3
      ${alertOptInOnly ? "AND w.alert_opt_in = true" : ""}
    ORDER BY d.deadline_date ASC
    LIMIT $4 OFFSET $5
  `;
  
  const result = await query(sql, [userId, now, future, limit, offset]);
  return result.rows;
};

/**
 * Count user's upcoming deadlines
 * 
 * @param userId - User UUID
 * @param lookAheadDays - Number of days in future to look
 * @param alertOptInOnly - Only count deadlines where user has alerts enabled
 * @returns Total count of matching deadlines
 */
export const countUserUpcomingDeadlines = async (
  userId: string,
  lookAheadDays: number = 7,
  alertOptInOnly: boolean = true
): Promise<number> => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + lookAheadDays);
  
  const now = new Date().toISOString();
  const future = futureDate.toISOString();
  
  const sql = `
    SELECT COUNT(DISTINCT d.id) as count
    FROM watchlists w
    JOIN admissions a ON w.admission_id = a.id
    JOIN deadlines d ON a.id = d.admission_id
    WHERE w.user_id = $1
      AND d.deadline_date >= $2
      AND d.deadline_date <= $3
      ${alertOptInOnly ? "AND w.alert_opt_in = true" : ""}
  `;
  
  const result = await query(sql, [userId, now, future]);
  return parseInt(result.rows[0]?.count || 0, 10);
};

/**
 * Find reminder targets for upcoming deadlines.
 *
 * Targets are users who:
 * - have the admission in watchlist
 * - opted in for alerts
 * - admission is active + verified
 * - deadline is within [now, now + lookAheadDays]
 */
export const findReminderTargets = async (
  lookAheadDays: number = 7
): Promise<DeadlineReminderTarget[]> => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + lookAheadDays);

  const now = new Date().toISOString();
  const future = futureDate.toISOString();

  const sql = `
    SELECT DISTINCT
      d.id::text AS deadline_id,
      d.deadline_type,
      d.deadline_date,
      a.id::text AS admission_id,
      a.title AS admission_title,
      w.user_id::text AS recipient_id
    FROM deadlines d
    JOIN admissions a ON a.id = d.admission_id
    JOIN watchlists w ON w.admission_id = a.id
    WHERE a.is_active = true
      AND a.verification_status = 'verified'
      AND w.alert_opt_in = true
      AND d.deadline_date >= $1
      AND d.deadline_date <= $2
    ORDER BY d.deadline_date ASC
  `;

  const result = await query(sql, [now, future]);
  return result.rows;
};

/**
 * Delete a deadline
 * 
 * @param id - Deadline UUID
 * @returns True if deleted, false if not found
 */
export const deleteById = async (id: string): Promise<boolean> => {
  const sql = 'DELETE FROM deadlines WHERE id = $1';
  const result = await query(sql, [id]);
  return (result.rowCount || 0) > 0;
}
