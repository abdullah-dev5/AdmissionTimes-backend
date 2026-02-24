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
import { query } from '@db/connection';
import * as adminModel from '../models/admin.model';
import {
  AdminVerifyAdmissionDTO,
  AdminBulkVerifyDTO,
  UserContext,
  AdminAdmission,
  AdminDashboard,
} from '../types/admin.types';
import {
  CHANGE_TYPE,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  USER_TYPE,
  VerificationStatus,
  type UserType,
} from '@config/constants';
import { publishNotification } from '@domain/notifications/services/notificationPublisher';

/**
 * Valid status transitions for admissions
 * Prevents invalid state changes (e.g., verified → pending)
 */
const VALID_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  draft: ['pending', 'rejected'],
  pending: ['verified', 'rejected', 'disputed'],
  verified: ['disputed'], // Can't unverify
  rejected: ['pending', 'disputed'],
  disputed: ['verified', 'rejected', 'pending'],
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
    // Get current admission
    const admission = await adminModel.getAdmissionById(admissionId);

    // Validate status transition
    validateStatusTransition(admission.verification_status, data.verification_status);

    // If rejecting, rejection_reason is required
    if (data.verification_status === 'rejected' && !data.rejection_reason) {
      throw new AppError('Rejection reason is required', 400);
    }

    // Update admission
    const updated = await adminModel.updateAdmissionVerification(admissionId, {
      verification_status: data.verification_status,
      verified_by: adminContext.id,
      rejection_reason:
        data.verification_status === 'rejected' ? data.rejection_reason : null,
      admin_notes: data.admin_notes || null,
      verification_comments: data.verification_comments || null,
      dispute_reason:
        data.verification_status === 'disputed' ? data.admin_notes || data.dispute_reason : null,
    });

    // Create audit log
    await adminModel.createAuditLog({
      admin_id: adminContext.id,
      action_type: data.verification_status === 'rejected' ? 'reject' : 'verify',
      entity_type: 'admission',
      entity_id: admissionId,
      old_values: { verification_status: admission.verification_status },
      new_values: { verification_status: data.verification_status },
      reason: data.rejection_reason || data.admin_notes || data.verification_comments || null,
      ip_address: null, // Passed from controller
      user_agent: null, // Passed from controller
      created_by: adminContext.email,
    });

    // Create changelog entry (keeps admin flow aligned with admissions service)
    const actionType = data.verification_status === 'verified'
      ? CHANGE_TYPE.VERIFIED
      : data.verification_status === 'rejected'
        ? CHANGE_TYPE.REJECTED
        : CHANGE_TYPE.DISPUTED;

    await createChangelogEntry({
      admission_id: admissionId,
      actor_type: 'admin',
      changed_by: adminContext.id,
      action_type: actionType,
      field_name: 'verification_status',
      old_value: admission.verification_status,
      new_value: data.verification_status,
      diff_summary: `Admission ${data.verification_status} by admin`,
      metadata: {
        rejection_reason: data.rejection_reason || null,
        admin_notes: data.admin_notes || null,
        verification_comments: data.verification_comments || null,
      },
    });

    // Notify university on verify/reject
    if (data.verification_status === 'verified' || data.verification_status === 'rejected') {
      await notifyUniversityForVerificationStatus(updated, data.verification_status, data.rejection_reason);
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

    if (!['pending', 'rejected', 'disputed'].includes(admission.verification_status)) {
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
      dispute_reason: null,
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

    return { data: admissions, total };
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
  status?: string
): Promise<{ data: any[]; total: number }> => {
  try {
    const admissions = await adminModel.getAllAdmissionsWithStatus(limit, offset, status);
    const total = await adminModel.getAllAdmissionsCount(status);

    return { data: admissions, total };
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

    return {
      stats,
      pending_verifications: pendingAdmissions,
      recent_actions: recentActions,
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
    return await adminModel.getAdmissionById(admissionId);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch admission details', 500);
  }
};
