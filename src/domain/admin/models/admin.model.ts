/**
 * Admin Domain - Model Layer
 * 
 * Direct database interactions using raw queries.
 * 
 * Responsibilities:
 * - Execute database queries
 * - Return raw database results
 * - No business logic
 * - No response formatting
 */

import { query } from '@db/connection';
import { AdminAdmission, AdminAuditLog, AdminDashboardStats } from '../types/admin.types';
import { AppError } from '@shared/middleware/errorHandler';

/**
 * Get pending admissions for admin verification
 */
export const getPendingAdmissions = async (
  limit: number = 50,
  offset: number = 0
): Promise<AdminAdmission[]> => {
  try {
    const result = await query(
      `SELECT 
         a.*, 
         u.name as university_name,
         a.title as admission_title,
         a.updated_at::text as submitted_on,
         'University' as submitted_by_label
       FROM admissions a
       LEFT JOIN universities u ON a.university_id = u.id
       WHERE a.verification_status = 'pending'
         AND a.is_active = true
       ORDER BY updated_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows as AdminAdmission[];
  } catch (error) {
    throw new AppError('Failed to fetch pending admissions', 500);
  }
};

/**
 * Get all admissions with university details and optional status filter
 */
export const getAllAdmissionsWithStatus = async (
  limit: number = 50,
  offset: number = 0,
  status?: string
): Promise<Array<AdminAdmission & { university_name?: string }>> => {
  try {
    let query_str = `
      SELECT 
        a.*,
        u.name as university_name
      FROM admissions a
      LEFT JOIN universities u ON a.university_id = u.id
      WHERE a.is_active = true
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status && status !== 'All') {
      query_str += ` AND a.verification_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query_str += ` ORDER BY a.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(query_str, params);

    return result.rows as Array<AdminAdmission & { university_name?: string }>;
  } catch (error) {
    throw new AppError('Failed to fetch admissions with status', 500);
  }
};

/**
 * Get count of admissions by status
 */
export const getAllAdmissionsCount = async (status?: string): Promise<number> => {
  try {
    let query_str = `SELECT COUNT(*) as count FROM admissions WHERE is_active = true`;
    const params: any[] = [];

    if (status && status !== 'All') {
      query_str += ` AND verification_status = $1`;
      params.push(status);
    }

    const result = await query(query_str, params);
    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    throw new AppError('Failed to fetch admissions count', 500);
  }
};

/**
 * Get admission by ID with admin details
 */
export const getAdmissionById = async (id: string): Promise<AdminAdmission> => {
  try {
    const result = await query(
      `SELECT 
         a.*, 
         u.name as university_name,
         a.title as admission_title,
         a.updated_at::text as submitted_on,
         'University' as submitted_by_label
       FROM admissions a
       LEFT JOIN universities u ON a.university_id = u.id
       WHERE a.id = $1
         AND a.is_active = true`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Admission not found', 404);
    }

    return result.rows[0] as AdminAdmission;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch admission', 500);
  }
};

/**
 * Update admission with verification
 */
export const updateAdmissionVerification = async (
  id: string,
  data: {
    verification_status: string;
    verified_by?: string;
    rejection_reason?: string | null;
    admin_notes?: string | null;
    verification_comments?: string | null;
  }
): Promise<AdminAdmission> => {
  try {
    const result = await query(
      `UPDATE admissions
       SET verification_status = $1::verification_status,
           verified_by = COALESCE($2, verified_by),
           rejection_reason = $3,
           admin_notes = $4,
           verification_comments = $6,
           verified_at = CASE WHEN $1::text IN ('verified', 'rejected') 
                              THEN NOW() 
                              ELSE verified_at END,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        data.verification_status,
        data.verified_by || null,
        data.rejection_reason || null,
        data.admin_notes || null,
        id,
        data.verification_comments || null,
      ]
    );

    if (result.rows.length === 0) {
      throw new AppError('Admission not found', 404);
    }

    return result.rows[0] as AdminAdmission;
  } catch (error) {
    console.error('Failed to update admission:', error);
    if (error instanceof AppError) throw error;
    const details = error instanceof Error ? error.message : 'Unknown error';
    throw new AppError(`Failed to update admission: ${details}`, 500);
  }
};

/**
 * Create audit log
 */
export const createAuditLog = async (data: {
  admin_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_by?: string;
}): Promise<AdminAuditLog> => {
  try {
    const result = await query(
      `INSERT INTO admin_audit_logs
       (admin_id, action_type, entity_type, entity_id, old_values, new_values, 
        reason, ip_address, user_agent, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        data.admin_id,
        data.action_type,
        data.entity_type,
        data.entity_id,
        data.old_values ? JSON.stringify(data.old_values) : null,
        data.new_values ? JSON.stringify(data.new_values) : null,
        data.reason || null,
        data.ip_address || null,
        data.user_agent || null,
        data.created_by || 'api',
      ]
    );

    return result.rows[0] as AdminAuditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging shouldn't block main operation
    return null as any;
  }
};

/**
 * Get dashboard statistics
 */
export const getDashboardStats = async (): Promise<AdminDashboardStats> => {
  try {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = true) as total_admissions,
         COUNT(*) FILTER (WHERE verification_status = 'pending' AND is_active = true) as pending_count,
         COUNT(*) FILTER (WHERE verification_status = 'verified' AND is_active = true) as verified_count,
         COUNT(*) FILTER (WHERE verification_status = 'rejected' AND is_active = true) as rejected_count,
         (SELECT COUNT(DISTINCT id) FROM universities WHERE is_active = true) as universities_active,
         (SELECT COUNT(DISTINCT id) FROM users WHERE role = 'student') as students_registered
       FROM admissions`
    );

    const row = result.rows[0];
    const total = parseInt(row.total_admissions) || 1;
    const verified = parseInt(row.verified_count) || 0;

    return {
      total_admissions: parseInt(row.total_admissions) || 0,
      pending_count: parseInt(row.pending_count) || 0,
      verified_count: parseInt(row.verified_count) || 0,
      rejected_count: parseInt(row.rejected_count) || 0,
      universities_active: parseInt(row.universities_active) || 0,
      students_registered: parseInt(row.students_registered) || 0,
      verification_rate: total > 0 ? Math.round((verified / total) * 100) : 0,
    };
  } catch (error) {
    throw new AppError('Failed to fetch dashboard stats', 500);
  }
};

/**
 * Get recent admin actions
 */
export const getRecentActions = async (limit: number = 10): Promise<AdminAuditLog[]> => {
  try {
    const result = await query(
      `SELECT 
         aal.*,
         a.title as admission_title
       FROM admin_audit_logs aal
       LEFT JOIN admissions a ON a.id::text = aal.entity_id::text
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows as AdminAuditLog[];
  } catch (error: any) {
    // If table doesn't exist yet (error code 42P01), return empty array
    if (error && error.code === '42P01') {
      console.warn('⚠️  admin_audit_logs table does not exist yet. Returning empty array.');
      return [];
    }
    throw new AppError('Failed to fetch recent actions', 500);
  }
};

/**
 * Get pending admissions count (for statistics)
 */
export const getPendingCount = async (): Promise<number> => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM admissions
       WHERE verification_status = 'pending'
         AND is_active = true`
    );

    return parseInt(result.rows[0].count) || 0;
  } catch (error) {
    throw new AppError('Failed to fetch pending count', 500);
  }
};
