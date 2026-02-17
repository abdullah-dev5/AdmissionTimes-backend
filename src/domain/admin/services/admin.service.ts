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
import * as adminModel from '../models/admin.model';
import {
  AdminVerifyAdmissionDTO,
  AdminBulkVerifyDTO,
  UserContext,
  AdminAdmission,
  AdminDashboard,
} from '../types/admin.types';
import { VerificationStatus } from '@config/constants';

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

    console.log(`✅ [ADMIN] Admission ${admissionId} verified by ${adminContext.email}`);

    return updated;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to verify admission', 500);
  }
};

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
