/**
 * Admin Domain - Service Layer
 * 
 * Business logic and orchestration for admin operations.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Enforce status transitions
 * - Create audit logs
 * - Coordinate between model and other services
 * - Send notifications
 * - Validate business rules
 */

import { AppError } from '@shared/middleware/errorHandler';
import { getClient, query } from '@db/connection';
import * as adminModel from '../models/admin.model';
import {
  AdminVerifyAdmissionDTO,
  AdminBulkVerifyDTO,
  AdminCreateUniversityRepDTO,
  AdminCreateUniversityRepResponse,
  UserContext,
  AdminAdmission,
  AdminDashboard,
} from '../types/admin.types';
import { config } from '@config/config';
import {
  CHANGE_TYPE,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  USER_TYPE,
  VerificationStatus,
  type UserType,
} from '@config/constants';
import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'crypto';
import { publishNotification } from '@domain/notifications/services/notificationPublisher';
import { withAdmissionContract } from '@shared/utils/admissionContract';

/**
 * Valid status transitions for admissions
 * Prevents invalid state changes (e.g., verified → pending)
 */
const VALID_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  draft: ['pending', 'rejected'],
  pending: ['verified', 'rejected'],
  verified: ['rejected'],
  rejected: ['pending'],
};

const normalizeVerificationStatus = (status: string): 'verified' | 'rejected' =>
  status === 'verified' ? 'verified' : 'rejected';

const buildTemporaryPassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const all = upper + lower + digits + symbols;

  const chars = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];

  while (chars.length < 12) {
    chars.push(all[randomInt(all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};

const redactSensitiveKeys = new Set([
  'email',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'ip_address',
  'user_agent',
  'phone',
  'contact_email',
  'contact_phone',
]);

const redactValue = (input: any): any => {
  if (Array.isArray(input)) {
    return input.map((item) => redactValue(item));
  }

  if (input && typeof input === 'object') {
    const next: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (redactSensitiveKeys.has(key.toLowerCase())) {
        next[key] = '[REDACTED]';
      } else {
        next[key] = redactValue(value);
      }
    }
    return next;
  }

  return input;
};

const sanitizeAuditLogForDashboard = (log: any): any => ({
  ...log,
  ip_address: null,
  user_agent: null,
  created_by: log?.created_by ? 'admin' : null,
  old_values: redactValue(log?.old_values || null),
  new_values: redactValue(log?.new_values || null),
});

const toActionLabel = (actionType: string | null | undefined): 'Verified' | 'Rejected' | 'Updated' => {
  const value = String(actionType || '').toLowerCase();
  if (value.includes('verify')) return 'Verified';
  if (value.includes('reject')) return 'Rejected';
  return 'Updated';
};

const toChangedByLabel = (createdBy: string | null | undefined): string => {
  const value = String(createdBy || '').trim();
  if (!value) return 'System';
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  return uuidLike ? 'System' : value;
};

const normalizeAdminAdmission = (admission: any): AdminAdmission => {
  const normalized = withAdmissionContract(admission || {}) as any;
  return {
    ...normalized,
    admission_title: normalized.admission_title || normalized.title || 'Unknown',
    submitted_on: normalized.submitted_on || normalized.updated_at || normalized.created_at || null,
    submitted_by_label: normalized.submitted_by_label || 'University',
    status_label:
      normalized.status_label === 'Pending'
        ? 'Pending Audit'
        : normalized.status_label || 'Pending Audit',
  } as AdminAdmission;
};

const getSupabaseAdminClient = () => {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new AppError('Supabase service role configuration is missing', 500);
  }

  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

/**
 * Verify admission is possible (validates state transition)
 */
const validateStatusTransition = (
  currentStatus: VerificationStatus,
  newStatus: string
): void => {
  if (!VALID_TRANSITIONS[currentStatus]?.includes(newStatus as VerificationStatus)) {
    throw new AppError(
      `Invalid status transition: ${currentStatus} → ${newStatus}`,
      400
    );
  }
};

/**
 * Verify admission
 */
export const verifyAdmission = async (
  admissionId: string,
  data: AdminVerifyAdmissionDTO,
  adminContext: UserContext
): Promise<AdminAdmission> => {
  try {
    const targetStatus = normalizeVerificationStatus(data.verification_status);

    // Get current admission
    const admission = await adminModel.getAdmissionById(admissionId);

    // Validate status transition
    validateStatusTransition(admission.verification_status, targetStatus);

    // If rejecting, rejection_reason is required
    if (targetStatus === 'rejected' && !data.rejection_reason) {
      throw new AppError('Rejection reason is required', 400);
    }

    // Update admission
    const updated = await adminModel.updateAdmissionVerification(admissionId, {
      verification_status: targetStatus,
      verified_by: adminContext.id,
      rejection_reason:
        targetStatus === 'rejected' ? data.rejection_reason : null,
      admin_notes: data.admin_notes || null,
      verification_comments: data.verification_comments || null,
    });

    // Create audit log
    await adminModel.createAuditLog({
      admin_id: adminContext.id,
      action_type: targetStatus === 'rejected' ? 'reject' : 'verify',
      entity_type: 'admission',
      entity_id: admissionId,
      old_values: { verification_status: admission.verification_status },
      new_values: { verification_status: targetStatus },
      reason: data.rejection_reason || data.admin_notes || data.verification_comments || null,
      ip_address: null, // Passed from controller
      user_agent: null, // Passed from controller
      created_by: adminContext.email,
    });

    // Create changelog entry (keeps admin flow aligned with admissions service)
    const actionType = targetStatus === 'verified'
      ? CHANGE_TYPE.VERIFIED
      : CHANGE_TYPE.REJECTED;

    await createChangelogEntry({
      admission_id: admissionId,
      actor_type: 'admin',
      changed_by: adminContext.id,
      action_type: actionType,
      field_name: 'verification_status',
      old_value: admission.verification_status,
      new_value: targetStatus,
      diff_summary: `Admission ${targetStatus} by admin`,
      metadata: {
        rejection_reason: data.rejection_reason || null,
        admin_notes: data.admin_notes || null,
        verification_comments: data.verification_comments || null,
      },
    });

    // Notify university on verify/reject
    if (targetStatus === 'verified' || targetStatus === 'rejected') {
      await notifyUniversityForVerificationStatus(updated, targetStatus, data.rejection_reason);
    }

    // Notify students watching this admission when it's verified (for re-verification too)
    if (targetStatus === 'verified') {
      await notifyStudentsForVerifiedAdmissionUpdate(updated);
    }

    console.log(`✅ [ADMIN] Admission ${admissionId} verified by ${adminContext.email}`);

    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to verify admission', 500);
  }
};

/**
 * Request revision on an admission (admin -> university)
 * Keeps verification_status as pending, but notifies the university to revise.
 */
export const requestRevision = async (
  admissionId: string,
  reason: string,
  adminContext: UserContext
): Promise<AdminAdmission> => {
  try {
    const admission = await adminModel.getAdmissionById(admissionId);

    if (!['pending', 'rejected'].includes(admission.verification_status)) {
      throw new AppError(
        `Cannot request revision for admission with status: ${admission.verification_status}`,
        400
      );
    }

    const updated = await adminModel.updateAdmissionVerification(admissionId, {
      verification_status: 'pending',
      verified_by: adminContext.id,
      rejection_reason: null,
      admin_notes: reason,
      verification_comments: reason,
    });

    await adminModel.createAuditLog({
      admin_id: adminContext.id,
      action_type: 'update_notes',
      entity_type: 'admission',
      entity_id: admissionId,
      old_values: { verification_status: admission.verification_status },
      new_values: { verification_status: 'pending' },
      reason,
      ip_address: null,
      user_agent: null,
      created_by: adminContext.email,
    });

    await createChangelogEntry({
      admission_id: admissionId,
      actor_type: 'admin',
      changed_by: adminContext.id,
      action_type: CHANGE_TYPE.STATUS_CHANGED,
      field_name: 'verification_status',
      old_value: admission.verification_status,
      new_value: 'pending',
      diff_summary: 'Revision requested by admin',
      metadata: {
        admin_notes: reason,
      },
    });

    await notifyUniversityForRevisionRequired(updated, reason);

    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to request revision', 500);
  }
};

async function notifyUniversityForVerificationStatus(
  admission: AdminAdmission,
  status: 'verified' | 'rejected',
  rejectionReason?: string
): Promise<void> {
  try {
    const { recipients, universityId } = await resolveUniversityRecipients(admission);

    if (!recipients.length) {
      console.warn(`⚠️ [ADMIN] No university recipients found for admission ${admission.id}`);
      return;
    }

    const notificationType = status === 'verified'
      ? NOTIFICATION_TYPE.ADMISSION_VERIFIED
      : NOTIFICATION_TYPE.ADMISSION_REJECTED;

    const title = status === 'verified' ? 'Admission Verified' : 'Admission Rejected';
    const message = status === 'verified'
      ? `Your admission "${admission.title}" has been verified and is now visible to students.`
      : `Your admission "${admission.title}" has been rejected. Reason: ${rejectionReason || 'No reason provided'}`;

    const eventKey = `${notificationType}:${admission.id}:${universityId || admission.created_by || 'unknown'}:${Date.now()}`;

    await publishNotification({
      recipients,
      notification_type: notificationType,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title,
      message,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
      event_key: eventKey,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Failed to notify university:', error?.message || error);
  }
}

async function notifyUniversityForRevisionRequired(
  admission: AdminAdmission,
  reason: string
): Promise<void> {
  try {
    const { recipients, universityId } = await resolveUniversityRecipients(admission);

    if (!recipients.length) {
      console.warn(`⚠️ [ADMIN] No university recipients found for revision request on admission ${admission.id}`);
      return;
    }

    const eventKey = `admission_revision_required:${admission.id}:${universityId || admission.created_by || 'unknown'}:${Date.now()}`;

    await publishNotification({
      recipients,
      notification_type: NOTIFICATION_TYPE.ADMISSION_REVISION_REQUIRED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: 'Revision Requested',
      message: `Admin requested revisions for "${admission.title}". Notes: ${reason}`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
      event_key: eventKey,
    });
  } catch (error: any) {
    console.error('❌ [ADMIN] Failed to send revision request notification:', error?.message || error);
  }
}

/**
 * Notify students who are watching this admission when it's verified/updated
 * This ensures students get notifications on EVERY re-verification
 */
async function notifyStudentsForVerifiedAdmissionUpdate(
  admission: AdminAdmission
): Promise<void> {
  try {
    console.log(`📢 [ADMIN] Creating student notification for verified admission ${admission.id}`);
    console.log(`   → Title: ${admission.title}`);

    if (!admission.id) {
      console.warn(`⚠️ [ADMIN] No admission ID provided for student notification`);
      return;
    }

    // Get all students who have this admission in their watchlist
    console.log(`   → Querying watchlist for students...`);
    const sql = `
      SELECT DISTINCT wl.user_id
      FROM watchlists wl
      WHERE wl.admission_id = $1
    `;
    const result = await query(sql, [admission.id]);
    const watchlistStudents = result.rows.map((row) => row.user_id as string);

    console.log(`   → Found ${watchlistStudents.length} students watching this admission`);

    if (watchlistStudents.length === 0) {
      console.log(`   → No students to notify`);
      return; // No students watching this admission
    }

    // Use updated_at + Date.now() for absolute uniqueness to ensure each update gets a new notification
    const eventKey = `admission_updated:${admission.id}:verified:${admission.updated_at}:${Date.now()}`;
    console.log(`   → Event key: ${eventKey}`);

    const result2 = await publishNotification({
      recipients: watchlistStudents.map((id) => ({ id, role: USER_TYPE.STUDENT })),
      notification_type: NOTIFICATION_TYPE.ADMISSION_UPDATED_SAVED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: `${admission.title} Updated`,
      message: `An admission you saved has been updated. Check the details for latest information.`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
      event_key: eventKey,
    });

    console.log(`✅ [ADMIN] Successfully sent verified admission update notification to ${watchlistStudents.length} students:`, result2);
  } catch (error: any) {
    console.error(`❌ [ADMIN] Failed to create student notification for admission ${admission.id}:`);
    console.error(`   → Error: ${error?.message || String(error)}`);
    if (error?.code) console.error(`   → Code: ${error.code}`);
  }
}

async function resolveUniversityRecipients(
  admission: AdminAdmission
): Promise<{ recipients: Array<{ id: string; role: UserType }>; universityId?: string | null }> {
  let universityId = admission.university_id || null;

  if (!universityId && admission.created_by) {
    const orgResult = await query(
      'SELECT university_id::text as university_id FROM users WHERE id = $1',
      [admission.created_by]
    );
    universityId = orgResult.rows[0]?.university_id || null;

    if (universityId) {
      await query('UPDATE admissions SET university_id = $1 WHERE id = $2', [universityId, admission.id]);
    }
  }

  if (universityId) {
    const recipientsResult = await query(
      'SELECT id::text as id FROM users WHERE role = $1 AND university_id = $2',
      [USER_TYPE.UNIVERSITY, universityId]
    );
    const recipients = recipientsResult.rows.map((row) => ({ id: row.id as string, role: USER_TYPE.UNIVERSITY }));
    return { recipients, universityId };
  }

  if (admission.created_by) {
    return { recipients: [{ id: admission.created_by, role: USER_TYPE.UNIVERSITY }], universityId: null };
  }

  return { recipients: [], universityId: null };
}

async function createChangelogEntry(entry: {
  admission_id: string;
  actor_type: 'admin' | 'university' | 'system';
  changed_by: string | null;
  action_type: string;
  field_name: string | null;
  old_value: any;
  new_value: any;
  diff_summary: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await query(
    `INSERT INTO changelogs (
      admission_id, actor_type, changed_by, action_type, field_name,
      old_value, new_value, diff_summary, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.admission_id,
      entry.actor_type,
      entry.changed_by,
      entry.action_type,
      entry.field_name,
      entry.old_value ? JSON.stringify(entry.old_value) : null,
      entry.new_value ? JSON.stringify(entry.new_value) : null,
      entry.diff_summary,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ]
  );
}

/**
 * Bulk verify admissions
 */
export const bulkVerifyAdmissions = async (
  data: AdminBulkVerifyDTO,
  adminContext: UserContext
): Promise<AdminAdmission[]> => {
  try {
    const results: AdminAdmission[] = [];

    // Process each admission
    for (const admissionId of data.admission_ids) {
      try {
        const result = await verifyAdmission(
          admissionId,
          {
            verification_status: data.verification_status,
            rejection_reason: data.rejection_reason,
            admin_notes: data.admin_notes,
          },
          adminContext
        );

        results.push(result);
      } catch (error) {
        console.warn(`Failed to verify admission ${admissionId}:`, error);
        // Continue with next admission
      }
    }

    console.log(
      `✅ [ADMIN] Bulk verified ${results.length} of ${data.admission_ids.length} admissions by ${adminContext.email}`
    );

    return results;
  } catch (error) {
    throw new AppError('Bulk verification failed', 500);
  }
};

/**
 * Get pending admissions
 */
export const getPendingAdmissions = async (
  limit: number = 50,
  offset: number = 0
): Promise<{ data: AdminAdmission[]; total: number }> => {
  try {
    const admissions = await adminModel.getPendingAdmissions(limit, offset);
    const total = await adminModel.getPendingCount();

    const normalizedAdmissions = admissions.map((admission) => normalizeAdminAdmission(admission));

    return { data: normalizedAdmissions, total };
  } catch (error) {
    throw new AppError('Failed to fetch pending admissions', 500);
  }
};

/**
 * Get all admissions with optional status filter
 */
export const getAllAdmissions = async (
  limit: number = 50,
  offset: number = 0,
  status?: string,
  dataOrigin?: string
): Promise<{ data: any[]; total: number }> => {
  try {
    const admissions = await adminModel.getAllAdmissionsWithStatus(limit, offset, status, dataOrigin);
    const total = await adminModel.getAllAdmissionsCount(status, dataOrigin);

    const normalizedAdmissions = admissions.map((admission) => normalizeAdminAdmission(admission));

    return { data: normalizedAdmissions, total };
  } catch (error) {
    throw new AppError('Failed to fetch all admissions', 500);
  }
};

/**
 * Get admin dashboard
 */
export const getAdminDashboard = async (): Promise<AdminDashboard> => {
  try {
    const [stats, pendingAdmissions, recentActions] = await Promise.all([
      adminModel.getDashboardStats(),
      adminModel.getPendingAdmissions(5, 0), // Top 5 pending
      adminModel.getRecentActions(10), // Last 10 actions
    ]);

    const normalizedPending = pendingAdmissions.map((admission) => normalizeAdminAdmission(admission));
    const sanitizedRecentActions = recentActions.map((log) => {
      const sanitized = sanitizeAuditLogForDashboard(log);
      return {
        ...sanitized,
        changed_at_iso: sanitized.created_at || null,
        admission_title: sanitized.admission_title || 'Unknown',
        action_label: toActionLabel(sanitized.action_type),
        changed_by_label: toChangedByLabel(sanitized.created_by),
      };
    }) as typeof recentActions;

    return {
      stats,
      pending_verifications: normalizedPending,
      recent_actions: sanitizedRecentActions,
    };
  } catch (error) {
    throw new AppError('Failed to fetch admin dashboard', 500);
  }
};

/**
 * Get single admission details (admin view)
 */
export const getAdmissionDetails = async (
  admissionId: string
): Promise<AdminAdmission> => {
  try {
    const admission = await adminModel.getAdmissionById(admissionId);
    return normalizeAdminAdmission(admission);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch admission details', 500);
  }
};

/**
 * Create university representative from admin panel (Flow C)
 */
export const createUniversityRep = async (
  data: AdminCreateUniversityRepDTO,
  adminContext: UserContext
): Promise<AdminCreateUniversityRepResponse> => {
  const email = data.email.trim().toLowerCase();
  const displayName = data.display_name.trim();
  const universityName = data.university_name.trim();
  const city = data.city?.trim() || null;
  const country = data.country?.trim() || null;
  const website = data.website?.trim() || null;

  const existingUserCheck = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
  if (existingUserCheck.rows.length > 0) {
    throw new AppError('Email already exists in users table', 409);
  }

  const temporaryPassword = buildTemporaryPassword();
  const supabaseAdmin = getSupabaseAdminClient();

  let authUserId: string | null = null;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        role: USER_TYPE.UNIVERSITY,
        display_name: displayName,
      },
    });

    if (authError || !authData.user?.id) {
      throw new AppError(authError?.message || 'Failed to create auth user', 400);
    }

    authUserId = authData.user.id;

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const universityResult = await client.query(
        `INSERT INTO universities (name, city, country, website, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id, name`,
        [universityName, city, country, website]
      );

      const university = universityResult.rows[0];

      const userResult = await client.query(
        `INSERT INTO users (auth_user_id, email, password, role, display_name, university_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
         RETURNING id, email, role, display_name, university_id`,
        [authUserId, email, temporaryPassword, USER_TYPE.UNIVERSITY, displayName, university.id]
      );

      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO admin_audit_logs
          (admin_id, action_type, entity_type, entity_id, old_values, new_values, reason, ip_address, user_agent, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, $8, NOW())`,
        [
          adminContext.id,
          'update_notes',
          'user',
          user.id,
          null,
          JSON.stringify({ email: user.email, role: user.role, university_id: user.university_id }),
          'Admin created university representative (Flow C)',
          adminContext.email || 'admin',
        ]
      );

      await client.query('COMMIT');

      return {
        user: {
          id: user.id,
          email: user.email,
          role: USER_TYPE.UNIVERSITY,
          university_id: user.university_id,
          display_name: user.display_name,
        },
        university: {
          id: university.id,
          name: university.name,
        },
        credentials: {
          temporary_password: temporaryPassword,
          show_once: true,
        },
      };
    } catch (dbError: any) {
      await client.query('ROLLBACK');

      if (authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => null);
      }

      throw new AppError(dbError?.message || 'Failed to create university representative', 500);
    } finally {
      client.release();
    }
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(error?.message || 'Failed to create university representative', 500);
  }
};
