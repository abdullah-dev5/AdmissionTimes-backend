/**
 * Admissions Domain - Model (data access only)
 */

import { query } from '@db/connection';
import { Admission, AdmissionFilters } from '../types/admissions.types';
import { calculateOffset } from '@shared/utils/pagination';
import { SORTABLE_FIELDS, SEARCH_FIELDS } from '../constants/admissions.constants';

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

const SELECT_WITH_UNIVERSITY = `
  SELECT
    a.*,
    u.name AS university_name,
    u.logo_url AS university_logo_url,
    u.city AS university_city,
    u.country AS university_country,
    u.website AS university_website
  FROM admissions a
  LEFT JOIN universities u ON u.id = a.university_id`;

/** Columns a create/update may write. Status columns are set only by dedicated helpers. */
export const CONTENT_COLUMNS = [
  'title',
  'description',
  'program_type',
  'degree_level',
  'field_of_study',
  'duration',
  'tuition_fee',
  'currency',
  'application_fee',
  'deadline',
  'start_date',
  'location',
  'delivery_mode',
  'requirements',
] as const;

export type ContentColumn = (typeof CONTENT_COLUMNS)[number];
export type AdmissionContent = Partial<Record<ContentColumn, unknown>>;

const serialize = (column: string, value: unknown): unknown =>
  column === 'requirements' && value !== null && value !== undefined ? JSON.stringify(value) : value;

export const findById = async (id: string, includeInactive = false): Promise<Admission | null> => {
  const result = await query(
    `${SELECT_WITH_UNIVERSITY} WHERE a.id = $1 ${includeInactive ? '' : 'AND a.is_active = true'}`,
    [id]
  );
  return result.rows[0] || null;
};

export const universityExists = async (universityId: string): Promise<boolean> => {
  const result = await query('SELECT 1 FROM universities WHERE id = $1', [universityId]);
  return result.rows.length > 0;
};

export const isWatchedBy = async (admissionId: string, userId: string): Promise<boolean> => {
  const result = await query('SELECT 1 FROM watchlists WHERE user_id = $1 AND admission_id = $2 LIMIT 1', [userId, admissionId]);
  return result.rows.length > 0;
};

export const insert = async (
  db: Queryable,
  data: AdmissionContent & {
    university_id: string;
    created_by: string | null;
    verification_status: string;
    verified_by?: string | null;
  }
): Promise<Admission> => {
  const columns = [...CONTENT_COLUMNS.filter((column) => data[column] !== undefined), 'university_id', 'created_by', 'updated_by', 'verification_status', 'is_active'];
  const values = [
    ...CONTENT_COLUMNS.filter((column) => data[column] !== undefined).map((column) => serialize(column, data[column])),
    data.university_id,
    data.created_by,
    data.created_by,
    data.verification_status,
    true,
  ];

  if (data.verification_status === 'verified') {
    columns.push('verified_by', 'verified_at');
    values.push(data.verified_by ?? null, new Date().toISOString());
  }

  const placeholders = values.map((_, index) => `$${index + 1}`);
  const result = await db.query(
    `INSERT INTO admissions (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  );
  return result.rows[0];
};

/**
 * Update content columns and, optionally, workflow state in one statement.
 */
export const updateContent = async (
  db: Queryable,
  id: string,
  content: AdmissionContent,
  state: {
    updated_by: string | null;
    verification_status?: string;
    needs_reverification?: boolean;
    clear_verification?: boolean;
  }
): Promise<Admission | null> => {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const column of CONTENT_COLUMNS) {
    if (content[column] !== undefined) {
      values.push(serialize(column, content[column]));
      sets.push(`${column} = $${values.length}`);
    }
  }

  values.push(state.updated_by);
  sets.push(`updated_by = $${values.length}`);

  if (state.verification_status) {
    values.push(state.verification_status);
    sets.push(`verification_status = $${values.length}::verification_status`);
  }
  if (state.needs_reverification !== undefined) {
    values.push(state.needs_reverification);
    sets.push(`needs_reverification = $${values.length}`);
  }
  if (state.clear_verification) {
    sets.push('verified_at = NULL', 'verified_by = NULL');
  }

  sets.push('updated_at = NOW()');
  values.push(id);

  const result = await db.query(
    `UPDATE admissions SET ${sets.join(', ')} WHERE id = $${values.length} AND is_active = true RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

export const setStatus = async (
  db: Queryable,
  id: string,
  status: string,
  updatedBy: string | null
): Promise<Admission | null> => {
  const result = await db.query(
    `UPDATE admissions
     SET verification_status = $2::verification_status, updated_by = $3, updated_at = NOW()
     WHERE id = $1 AND is_active = true
     RETURNING *`,
    [id, status, updatedBy]
  );
  return result.rows[0] || null;
};

export const softDelete = async (db: Queryable, id: string, deletedBy: string | null): Promise<Admission | null> => {
  const result = await db.query(
    `UPDATE admissions SET is_active = false, updated_by = $2, updated_at = NOW()
     WHERE id = $1 AND is_active = true
     RETURNING *`,
    [id, deletedBy]
  );
  return result.rows[0] || null;
};

/**
 * Keep the `deadlines` row of type 'application' in sync with
 * admissions.deadline. Reminder bookkeeping resets whenever the date moves.
 */
export const syncApplicationDeadline = async (db: Queryable, admissionId: string, deadline: string | Date | null): Promise<void> => {
  if (!deadline) {
    await db.query(`DELETE FROM deadlines WHERE admission_id = $1 AND deadline_type = 'application'`, [admissionId]);
    return;
  }

  const updated = await db.query(
    `UPDATE deadlines
     SET deadline_date = $2,
         reminder_sent = CASE WHEN deadline_date IS DISTINCT FROM $2 THEN false ELSE reminder_sent END,
         reminder_sent_7d_at = CASE WHEN deadline_date IS DISTINCT FROM $2 THEN NULL ELSE reminder_sent_7d_at END,
         reminder_sent_3d_at = CASE WHEN deadline_date IS DISTINCT FROM $2 THEN NULL ELSE reminder_sent_3d_at END,
         reminder_sent_1d_at = CASE WHEN deadline_date IS DISTINCT FROM $2 THEN NULL ELSE reminder_sent_1d_at END,
         updated_at = NOW()
     WHERE admission_id = $1 AND deadline_type = 'application'
     RETURNING id`,
    [admissionId, deadline]
  );

  if (updated.rows.length === 0) {
    await db.query(
      `INSERT INTO deadlines (admission_id, deadline_type, deadline_date) VALUES ($1, 'application', $2)`,
      [admissionId, deadline]
    );
  }
};

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

const buildWhere = (filters: AdmissionFilters): { where: string; params: unknown[] } => {
  const conditions: string[] = ['a.is_active = true'];
  const params: unknown[] = [];
  const add = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.verification_status) {
    const statuses = Array.isArray(filters.verification_status) ? filters.verification_status : [filters.verification_status];
    conditions.push(`a.verification_status::text = ANY(${add(statuses)}::text[])`);
  }

  if (filters.university_id) {
    conditions.push(`a.university_id = ${add(filters.university_id)}`);
  }

  if (filters.created_by) {
    conditions.push(`a.created_by = ${add(filters.created_by)}`);
  }

  if (filters.exclude_closed) {
    conditions.push('(a.deadline IS NULL OR a.deadline >= NOW())');
  }
  if (filters.deadline_from) {
    conditions.push(`a.deadline >= ${add(filters.deadline_from)}`);
  }
  if (filters.deadline_to) {
    conditions.push(`a.deadline <= ${add(filters.deadline_to)}`);
  }

  const ilike = (column: string, value?: string) => {
    if (value) conditions.push(`a.${column} ILIKE ${add(`%${value}%`)}`);
  };
  ilike('program_type', filters.program_type);
  ilike('degree_level', filters.degree_level);
  ilike('field_of_study', filters.field_of_study);
  ilike('location', filters.location);

  if (filters.delivery_mode) {
    conditions.push(`a.delivery_mode = ${add(filters.delivery_mode)}`);
  }

  if (filters.search) {
    const term = add(`%${filters.search}%`);
    const searchConditions = [
      ...SEARCH_FIELDS.map((field) => `a.${field} ILIKE ${term}`),
      `u.name ILIKE ${term}`,
      `u.city ILIKE ${term}`,
      `u.country ILIKE ${term}`,
    ];
    conditions.push(`(${searchConditions.join(' OR ')})`);
  }

  return { where: conditions.join(' AND '), params };
};

export const count = async (filters: AdmissionFilters): Promise<number> => {
  const { where, params } = buildWhere(filters);
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM admissions a LEFT JOIN universities u ON u.id = a.university_id WHERE ${where}`,
    params
  );
  return result.rows[0].count;
};

export const findMany = async (
  filters: AdmissionFilters,
  page: number,
  limit: number,
  sort: string = 'created_at',
  order: 'asc' | 'desc' = 'desc'
): Promise<Admission[]> => {
  const { where, params } = buildWhere(filters);
  const sortField = (SORTABLE_FIELDS as readonly string[]).includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  // Deadline sorts put programs without a deadline last in either direction.
  const nulls = sortField === 'deadline' ? ' NULLS LAST' : '';

  params.push(limit, calculateOffset(page, limit));
  const result = await query(
    `${SELECT_WITH_UNIVERSITY}
     WHERE ${where}
     ORDER BY a.${sortField} ${sortOrder}${nulls}, a.id
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

export const findChangelogs = async (admissionId: string, limit: number, offset: number) => {
  const [rows, total] = await Promise.all([
    query(
      `SELECT * FROM changelogs WHERE admission_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [admissionId, limit, offset]
    ),
    query(`SELECT COUNT(*)::int AS count FROM changelogs WHERE admission_id = $1`, [admissionId]),
  ]);
  return { changelogs: rows.rows, total: total.rows[0].count as number };
};
