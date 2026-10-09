/**
 * Admin Domain - Model
 */

import { query } from '@db/connection';
import { AdminAdmission, AdminAuditLog, AdminDashboardStats, AdminFilterParams } from '../types/admin.types';
import { AppError } from '@shared/middleware/errorHandler';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('AdminModel');

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

const ADMIN_SORT_COLUMNS: Record<string, string> = {
  created_at: 'a.created_at',
  updated_at: 'a.updated_at',
  verified_at: 'a.verified_at',
  status: 'a.verification_status',
  deadline: 'a.deadline',
  title: 'a.title',
};

const buildAdminWhere = (filters: AdminFilterParams): { where: string; params: unknown[] } => {
  const conditions = ['a.is_active = true'];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.status) conditions.push(`a.verification_status = ${add(filters.status)}::verification_status`);
  if (filters.data_origin) conditions.push(`COALESCE(a.data_origin, 'manual') = ${add(filters.data_origin)}`);
  if (filters.university_id) conditions.push(`a.university_id = ${add(filters.university_id)}`);
  if (filters.verified_by) conditions.push(`a.verified_by = ${add(filters.verified_by)}`);
  if (filters.date_from) conditions.push(`a.updated_at >= ${add(filters.date_from)}`);
  if (filters.date_to) conditions.push(`a.updated_at <= ${add(filters.date_to)}`);
  if (filters.needs_reverification !== undefined) conditions.push(`a.needs_reverification = ${add(filters.needs_reverification)}`);
  if (filters.search) {
    const term = add(`%${filters.search}%`);
    conditions.push(`(a.title ILIKE ${term} OR u.name ILIKE ${term} OR a.field_of_study ILIKE ${term})`);
  }

  return { where: conditions.join(' AND '), params };
};

export const listAdmissions = async (
  filters: AdminFilterParams,
  limit: number,
  offset: number
): Promise<{ rows: AdminAdmission[]; total: number }> => {
  const { where, params } = buildAdminWhere(filters);
  const sortColumn = ADMIN_SORT_COLUMNS[filters.sort || 'updated_at'] || 'a.updated_at';
  const order = filters.order === 'asc' ? 'ASC' : 'DESC';

  const [rows, total] = await Promise.all([
    query(
      `SELECT a.*, u.name AS university_name, a.title AS admission_title,
              a.updated_at::text AS submitted_on, 'University' AS submitted_by_label
       FROM admissions a
       LEFT JOIN universities u ON u.id = a.university_id
       WHERE ${where}
       ORDER BY ${sortColumn} ${order} NULLS LAST, a.id
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM admissions a LEFT JOIN universities u ON u.id = a.university_id WHERE ${where}`,
      params
    ),
  ]);

  return { rows: rows.rows, total: total.rows[0].count };
};

export const getAdmissionById = async (id: string, db: Queryable = { query }): Promise<AdminAdmission> => {
  const result = await db.query(
    `SELECT a.*, u.name AS university_name, a.title AS admission_title,
            a.updated_at::text AS submitted_on, 'University' AS submitted_by_label
     FROM admissions a
     LEFT JOIN universities u ON u.id = a.university_id
     WHERE a.id = $1 AND a.is_active = true`,
    [id]
  );
  if (result.rows.length === 0) throw new AppError('Admission not found', 404);
  return result.rows[0];
};

/** Lock the admission row for a moderation decision. */
export const lockAdmission = async (db: Queryable, id: string): Promise<AdminAdmission> => {
  const result = await db.query(`SELECT * FROM admissions WHERE id = $1 AND is_active = true FOR UPDATE`, [id]);
  if (result.rows.length === 0) throw new AppError('Admission not found', 404);
  return result.rows[0];
};

export const applyModeration = async (
  db: Queryable,
  id: string,
  data: {
    verification_status: 'verified' | 'rejected' | 'pending';
    admin_id: string;
    rejection_reason?: string | null;
    admin_notes?: string | null;
    verification_comments?: string | null;
  }
): Promise<AdminAdmission> => {
  const result = await db.query(
    `UPDATE admissions
     SET verification_status = $2::verification_status,
         verified_by = CASE WHEN $2 = 'verified' THEN $3::uuid ELSE verified_by END,
         verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE verified_at END,
         rejection_reason = CASE WHEN $2 = 'rejected' THEN $4 ELSE NULL END,
         admin_notes = COALESCE($5, admin_notes),
         verification_comments = COALESCE($6, verification_comments),
         needs_reverification = CASE WHEN $2 = 'verified' THEN false ELSE needs_reverification END,
         updated_by = $3::uuid,
         updated_at = NOW()
     WHERE id = $1 AND is_active = true
     RETURNING *`,
    [id, data.verification_status, data.admin_id, data.rejection_reason ?? null, data.admin_notes ?? null, data.verification_comments ?? null]
  );
  if (result.rows.length === 0) throw new AppError('Admission not found', 404);
  return result.rows[0];
};

/**
 * Write an admin audit entry. Audit failures are logged, not thrown, so an
 * audit-table problem never blocks moderation.
 */
export const createAuditLog = async (
  data: {
    admin_id: string;
    action_type: string;
    entity_type: string;
    entity_id: string;
    old_values?: Record<string, any> | null;
    new_values?: Record<string, any> | null;
    reason?: string | null;
    created_by?: string | null;
  },
  db: Queryable = { query }
): Promise<void> => {
  try {
    await db.query(
      `INSERT INTO admin_audit_logs
         (admin_id, action_type, entity_type, entity_id, old_values, new_values, reason, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        data.admin_id,
        data.action_type,
        data.entity_type,
        data.entity_id,
        data.old_values ? JSON.stringify(data.old_values) : null,
        data.new_values ? JSON.stringify(data.new_values) : null,
        data.reason || null,
        data.created_by || 'admin',
      ]
    );
  } catch (error) {
    log.error('Failed to write audit log', (error as Error)?.message);
  }
};

export const getDashboardStats = async (): Promise<AdminDashboardStats> => {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE is_active) AS total_admissions,
       COUNT(*) FILTER (WHERE is_active AND verification_status = 'pending') AS pending_count,
       COUNT(*) FILTER (WHERE is_active AND verification_status = 'verified') AS verified_count,
       COUNT(*) FILTER (WHERE is_active AND verification_status = 'rejected') AS rejected_count,
       COUNT(*) FILTER (WHERE is_active AND needs_reverification) AS reverification_count,
       (SELECT COUNT(*) FROM universities WHERE is_active) AS universities_active,
       (SELECT COUNT(*) FROM users WHERE role = 'student') AS students_registered
     FROM admissions`
  );

  const row = result.rows[0];
  const total = Number(row.total_admissions) || 0;
  const verified = Number(row.verified_count) || 0;

  return {
    total_admissions: total,
    pending_count: Number(row.pending_count) || 0,
    verified_count: verified,
    rejected_count: Number(row.rejected_count) || 0,
    reverification_count: Number(row.reverification_count) || 0,
    universities_active: Number(row.universities_active) || 0,
    students_registered: Number(row.students_registered) || 0,
    // Fixed: previously divided by 1 when there were no admissions.
    verification_rate: total > 0 ? Math.round((verified / total) * 100) : 0,
  };
};

export const getRecentActions = async (limit: number = 10): Promise<AdminAuditLog[]> => {
  const result = await query(
    `SELECT aal.*, a.title AS admission_title
     FROM admin_audit_logs aal
     LEFT JOIN admissions a ON aal.entity_type = 'admission' AND a.id = aal.entity_id
     ORDER BY aal.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

export const findUniversityById = async (db: Queryable, id: string): Promise<{ id: string; name: string } | null> => {
  const result = await db.query(`SELECT id::text AS id, name FROM universities WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

export const findUniversityByName = async (db: Queryable, name: string): Promise<{ id: string; name: string } | null> => {
  const result = await db.query(
    // Duplicate names exist from older data: prefer the university that is
    // actually in use (admissions, then representatives), then the oldest.
    `SELECT u.id::text AS id, u.name
     FROM universities u
     WHERE lower(trim(u.name)) = lower(trim($1))
     ORDER BY
       (SELECT COUNT(*) FROM admissions a WHERE a.university_id = u.id AND a.is_active) DESC,
       (SELECT COUNT(*) FROM users r WHERE r.university_id = u.id) DESC,
       u.created_at ASC
     LIMIT 1`,
    [name]
  );
  return result.rows[0] || null;
};
