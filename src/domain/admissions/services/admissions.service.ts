/**
 * Admissions Domain - Service Layer
 * 
 * Business logic and orchestration for admissions.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Enforce status transitions
 * - Create changelogs
 * - Coordinate between model and other services
 * - Validate business rules
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as admissionsModel from '../models/admissions.model';
import {
  Admission,
  CreateAdmissionDTO,
  UpdateAdmissionDTO,
  AdmissionFilters,
  VerifyAdmissionDTO,
  RejectAdmissionDTO,
  SubmitAdmissionDTO,
  DisputeAdmissionDTO,
  UserContext,
} from '../types/admissions.types';
import { VERIFICATION_STATUS, CHANGE_TYPE } from '@config/constants';

/**
 * Get admission by ID
 * 
 * @param id - Admission UUID
 * @param userContext - User context (for access control)
 * @returns Admission record
 * @throws AppError if not found or access denied
 */
export const getById = async (
  id: string,
  userContext?: UserContext
): Promise<Admission> => {
  const admission = await admissionsModel.findById(id);

  if (!admission) {
    throw new AppError('Admission not found', 404);
  }

  // Public access: only verified admissions
  if (!userContext || userContext.role === 'guest' || userContext.role === 'student') {
    if (admission.verification_status !== VERIFICATION_STATUS.VERIFIED) {
      throw new AppError('Admission not found', 404);
    }
  }

  // University can see their own admissions regardless of status
  if (userContext?.role === 'university' && userContext.university_id) {
    if (admission.created_by === userContext.id || admission.university_id === userContext.university_id) {
      // Track activity: user viewed admission
      trackAdmissionView(id, userContext).catch(() => {
        // Silently fail - activity tracking should not break the request
      });
      return admission;
    }
  }

  // Admin can see all admissions
  if (userContext?.role === 'admin') {
    // Track activity: admin viewed admission
    trackAdmissionView(id, userContext).catch(() => {
      // Silently fail - activity tracking should not break the request
    });
    return admission;
  }

  // Default: only verified admissions for public
  if (admission.verification_status !== VERIFICATION_STATUS.VERIFIED) {
    throw new AppError('Admission not found', 404);
  }

  // Track activity: public/student viewed admission
  trackAdmissionView(id, userContext).catch(() => {
    // Silently fail - activity tracking should not break the request
  });

  return admission;
};

/**
 * Get multiple admissions with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @param userContext - User context (for access control)
 * @returns Object with admissions array and total count
 */
export const getMany = async (
  filters: AdmissionFilters,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc',
  userContext?: UserContext
): Promise<{ admissions: Admission[]; total: number }> => {
  // Apply access control filters
  const effectiveFilters = applyAccessControl(filters, userContext);

  // Get admissions and total count
  const [admissions, total] = await Promise.all([
    admissionsModel.findMany(effectiveFilters, page, limit, sort, order),
    admissionsModel.count(effectiveFilters),
  ]);

  return { admissions, total };
};

/**
 * Create a new admission
 * 
 * @param data - Admission data
 * @param userContext - User context
 * @returns Created admission
 */
export const create = async (
  data: CreateAdmissionDTO,
  userContext?: UserContext
): Promise<Admission> => {
  // Create admission (always as draft)
  // Convert undefined to null for all optional fields
  const admissionData = {
    title: data.title,
    description: data.description ?? null,
    program_type: data.program_type ?? null,
    degree_level: data.degree_level ?? null,
    field_of_study: data.field_of_study ?? null,
    duration: data.duration ?? null,
    tuition_fee: data.tuition_fee ?? null,
    currency: data.currency ?? null,
    application_fee: data.application_fee ?? null,
    deadline: data.deadline ?? null,
    start_date: data.start_date ?? null,
    location: data.location ?? null,
    delivery_mode: data.delivery_mode ?? null,
    requirements: data.requirements ?? null,
    verification_status: data.verification_status || 'draft',
    university_id: data.university_id || userContext?.university_id || null,
    verified_at: null,
    verified_by: null,
    rejection_reason: null,
    dispute_reason: null,
    created_by: null, // Will be set by model from second parameter
    is_active: true,
  };

  const admission = await admissionsModel.create(admissionData, userContext?.id || null);

  // Create changelog entry
  await createChangelogEntry({
    admission_id: admission.id,
    actor_type: 'university',
    changed_by: userContext?.id || null,
    action_type: CHANGE_TYPE.CREATED,
    field_name: null,
    old_value: null,
    new_value: admission,
    diff_summary: 'Admission created',
  });

  return admission;
};

/**
 * Update an existing admission
 * 
 * @param id - Admission UUID
 * @param data - Update data
 * @param userContext - User context
 * @returns Updated admission
 * @throws AppError if cannot be updated
 */
export const update = async (
  id: string,
  data: UpdateAdmissionDTO,
  userContext?: UserContext
): Promise<Admission> => {
  // Get existing admission
  const existing = await admissionsModel.findById(id, true);

  if (!existing) {
    throw new AppError('Admission not found', 404);
  }

  // Check if can be updated based on status
  if (existing.verification_status === VERIFICATION_STATUS.PENDING) {
    throw new AppError('Cannot update pending admission', 400);
  }

  // Handle verified → pending transition
  let updateData: any = { ...data };

  if (existing.verification_status === VERIFICATION_STATUS.VERIFIED) {
    // Editing verified admission moves it to pending
    updateData.verification_status = VERIFICATION_STATUS.PENDING;
    updateData.verified_at = null;
    updateData.verified_by = null;
  }

  // Update admission
  const updated = await admissionsModel.update(id, updateData);

  if (!updated) {
    throw new AppError('Failed to update admission', 500);
  }

  // Create changelog entries for changed fields
  await createChangelogForUpdate(existing, updated, userContext);

  return updated;
};

/**
 * Verify an admission (admin only)
 * 
 * @param id - Admission UUID
 * @param data - Verification data
 * @param userContext - User context
 * @returns Verified admission
 * @throws AppError if cannot be verified
 */
export const verify = async (
  id: string,
  data: VerifyAdmissionDTO,
  userContext?: UserContext
): Promise<Admission> => {
  const existing = await admissionsModel.findById(id, true);

  if (!existing) {
    throw new AppError('Admission not found', 404);
  }

  // Only pending or disputed admissions can be verified
  if (
    existing.verification_status !== VERIFICATION_STATUS.PENDING &&
    existing.verification_status !== VERIFICATION_STATUS.DISPUTED
  ) {
    throw new AppError(
      `Cannot verify admission with status: ${existing.verification_status}`,
      400
    );
  }

  // Update admission
  const updated = await admissionsModel.update(id, {
    verification_status: VERIFICATION_STATUS.VERIFIED,
    verified_at: new Date().toISOString(),
    verified_by: data.verified_by || userContext?.id || null,
    rejection_reason: null, // Clear rejection reason if present
    dispute_reason: null, // Clear dispute reason if present
  });

  if (!updated) {
    throw new AppError('Failed to verify admission', 500);
  }

  // Create changelog entry
  await createChangelogEntry({
    admission_id: updated.id,
    actor_type: 'admin',
    changed_by: data.verified_by || userContext?.id || null,
    action_type: CHANGE_TYPE.VERIFIED,
    field_name: 'verification_status',
    old_value: existing.verification_status,
    new_value: VERIFICATION_STATUS.VERIFIED,
    diff_summary: 'Admission verified by admin',
  });

  // Create notification for university (if created_by exists)
  if (updated.created_by) {
    createNotificationForVerification(updated).catch(() => {
      // Silently fail - notification should not break the request
    });
  }

  return updated;
};

/**
 * Reject an admission (admin only)
 * 
 * @param id - Admission UUID
 * @param data - Rejection data
 * @param userContext - User context
 * @returns Rejected admission
 * @throws AppError if cannot be rejected
 */
export const reject = async (
  id: string,
  data: RejectAdmissionDTO,
  userContext?: UserContext
): Promise<Admission> => {
  const existing = await admissionsModel.findById(id, true);

  if (!existing) {
    throw new AppError('Admission not found', 404);
  }

  // Only pending admissions can be rejected
  if (existing.verification_status !== VERIFICATION_STATUS.PENDING) {
    throw new AppError(
      `Cannot reject admission with status: ${existing.verification_status}`,
      400
    );
  }

  // Update admission
  const updated = await admissionsModel.update(id, {
    verification_status: VERIFICATION_STATUS.REJECTED,
    rejection_reason: data.rejection_reason,
    verified_at: null,
    verified_by: null,
  });

  if (!updated) {
    throw new AppError('Failed to reject admission', 500);
  }

  // Create changelog entry
  await createChangelogEntry({
    admission_id: updated.id,
    actor_type: 'admin',
    changed_by: data.rejected_by || userContext?.id || null,
    action_type: CHANGE_TYPE.REJECTED,
    field_name: 'verification_status',
    old_value: existing.verification_status,
    new_value: VERIFICATION_STATUS.REJECTED,
    diff_summary: `Admission rejected: ${data.rejection_reason}`,
    metadata: {
      rejection_reason: data.rejection_reason,
    },
  });

  // Create notification for university (if created_by exists)
  if (updated.created_by) {
    createNotificationForRejection(updated, data.rejection_reason).catch(() => {
      // Silently fail - notification should not break the request
    });
  }

  return updated;
};

/**
 * Submit an admission (university - moves draft to pending)
 * 
 * @param id - Admission UUID
 * @param data - Submit data
 * @param userContext - User context
 * @returns Submitted admission
 * @throws AppError if cannot be submitted
 */
export const submit = async (
  id: string,
  data: SubmitAdmissionDTO,
  userContext?: UserContext
): Promise<Admission> => {
  const existing = await admissionsModel.findById(id, true);

  if (!existing) {
    throw new AppError('Admission not found', 404);
  }

  // Only draft admissions can be submitted
  if (existing.verification_status !== VERIFICATION_STATUS.DRAFT) {
    throw new AppError(
      `Cannot submit admission with status: ${existing.verification_status}. Only draft admissions can be submitted.`,
      400
    );
  }

  // Update admission to pending
  const updated = await admissionsModel.update(id, {
    verification_status: VERIFICATION_STATUS.PENDING,
  });

  if (!updated) {
    throw new AppError('Failed to submit admission', 500);
  }

  // Create changelog entry
  await createChangelogEntry({
    admission_id: updated.id,
    actor_type: 'university',
    changed_by: data.submitted_by || userContext?.id || null,
    action_type: CHANGE_TYPE.STATUS_CHANGED as any,
    field_name: 'verification_status',
    old_value: VERIFICATION_STATUS.DRAFT,
    new_value: VERIFICATION_STATUS.PENDING,
    diff_summary: 'Admission submitted for verification',
  });

  return updated;
};

/**
 * Dispute a rejected admission (university - moves rejected to disputed)
 * 
 * @param id - Admission UUID
 * @param data - Dispute data
 * @param userContext - User context
 * @returns Disputed admission
 * @throws AppError if cannot be disputed
 */
export const dispute = async (
  id: string,
  data: DisputeAdmissionDTO,
  userContext?: UserContext
): Promise<Admission> => {
  const existing = await admissionsModel.findById(id, true);

  if (!existing) {
    throw new AppError('Admission not found', 404);
  }

  // Only rejected admissions can be disputed
  if (existing.verification_status !== VERIFICATION_STATUS.REJECTED) {
    throw new AppError(
      `Cannot dispute admission with status: ${existing.verification_status}. Only rejected admissions can be disputed.`,
      400
    );
  }

  // Update admission to disputed
  const updated = await admissionsModel.update(id, {
    verification_status: VERIFICATION_STATUS.DISPUTED,
    dispute_reason: data.dispute_reason,
  });

  if (!updated) {
    throw new AppError('Failed to dispute admission', 500);
  }

  // Create changelog entry
  await createChangelogEntry({
    admission_id: updated.id,
    actor_type: 'university',
    changed_by: data.disputed_by || userContext?.id || null,
    action_type: CHANGE_TYPE.DISPUTED as any,
    field_name: 'verification_status',
    old_value: VERIFICATION_STATUS.REJECTED,
    new_value: VERIFICATION_STATUS.DISPUTED,
    diff_summary: `Admission disputed: ${data.dispute_reason}`,
    metadata: {
      dispute_reason: data.dispute_reason,
      original_rejection_reason: existing.rejection_reason,
    },
  });

  // Create notification for admin (when admission is disputed)
  createNotificationForDispute(updated, data.dispute_reason).catch(() => {
    // Silently fail - notification should not break the request
  });

  return updated;
};

/**
 * Get changelogs for an admission
 * 
 * @param admissionId - Admission UUID
 * @param page - Page number
 * @param limit - Items per page
 * @returns Object with changelogs array and total count
 */
export const getChangelogs = async (
  admissionId: string,
  page: number,
  limit: number
): Promise<{ changelogs: any[]; total: number }> => {
  // Verify admission exists
  const admission = await admissionsModel.findById(admissionId);
  if (!admission) {
    throw new AppError('Admission not found', 404);
  }

  // Get changelogs (delegate to changelogs service/model)
  // For now, we'll implement a simple query here
  // In Phase 4, this should use changelogs service
  const { query } = await import('@db/connection');
  const offset = (page - 1) * limit;

  const [changelogsResult, countResult] = await Promise.all([
    query(
      'SELECT * FROM changelogs WHERE admission_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [admissionId, limit, offset]
    ),
    query('SELECT COUNT(*) as count FROM changelogs WHERE admission_id = $1', [admissionId]),
  ]);

  return {
    changelogs: changelogsResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
  };
};

/**
 * Apply access control filters based on user context
 * 
 * @param filters - Original filters
 * @param userContext - User context
 * @returns Filters with access control applied
 */
function applyAccessControl(
  filters: AdmissionFilters,
  userContext?: UserContext
): AdmissionFilters {
  const effectiveFilters = { ...filters };

  // Public/Student: only verified admissions
  if (!userContext || userContext.role === 'guest' || userContext.role === 'student') {
    effectiveFilters.verification_status = VERIFICATION_STATUS.VERIFIED;
    effectiveFilters.is_active = true;
  }

  // University: can filter by created_by to see their own
  if (userContext?.role === 'university' && userContext.university_id) {
    // If filtering for own admissions, show all statuses
    if (effectiveFilters.created_by === userContext.id) {
      // Allow all statuses for own admissions
    } else if (!effectiveFilters.verification_status) {
      // Default: only verified for others
      effectiveFilters.verification_status = VERIFICATION_STATUS.VERIFIED;
    }
  }

  // Admin: can see all (no restrictions)
  // No changes needed for admin

  return effectiveFilters;
}

/**
 * Create changelog entry
 * 
 * @param entry - Changelog entry data
 */
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
  const { query } = await import('@db/connection');

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
 * Create changelog entries for all changed fields in an update
 * 
 * @param oldAdmission - Previous admission state
 * @param newAdmission - Updated admission state
 * @param userContext - User context
 */
async function createChangelogForUpdate(
  oldAdmission: Admission,
  newAdmission: Admission,
  userContext?: UserContext
): Promise<void> {
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Compare all fields
  const fieldsToCompare: (keyof Admission)[] = [
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
    'verification_status',
  ];

  for (const field of fieldsToCompare) {
    const oldValue = oldAdmission[field];
    const newValue = newAdmission[field];

    // Compare values (handle JSONB for requirements)
    if (field === 'requirements') {
      const oldJson = oldValue ? JSON.stringify(oldValue) : null;
      const newJson = newValue ? JSON.stringify(newValue) : null;
      if (oldJson !== newJson) {
        changes.push({ field, oldValue, newValue });
      }
    } else if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }

  // Create changelog entries for each change
  for (const change of changes) {
    let diffSummary = '';
    let actionType = CHANGE_TYPE.UPDATED;

    // Special handling for status changes
    if (change.field === 'verification_status') {
      actionType = CHANGE_TYPE.STATUS_CHANGED as any; // Type assertion needed for status_changed
      diffSummary = `Status changed from ${change.oldValue} to ${change.newValue}`;
      if (change.newValue === VERIFICATION_STATUS.PENDING && change.oldValue === VERIFICATION_STATUS.VERIFIED) {
        diffSummary = 'Status changed from verified to pending (requires re-verification)';
      }
    } else {
      // Generate human-readable diff summary
      const fieldName = change.field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      if (change.oldValue === null || change.oldValue === '') {
        diffSummary = `${fieldName} set to ${change.newValue}`;
      } else if (change.newValue === null || change.newValue === '') {
        diffSummary = `${fieldName} cleared`;
      } else {
        diffSummary = `${fieldName} changed from "${change.oldValue}" to "${change.newValue}"`;
      }
    }

    await createChangelogEntry({
      admission_id: newAdmission.id,
      actor_type: userContext?.role === 'admin' ? 'admin' : 'university',
      changed_by: userContext?.id || null,
      action_type: actionType,
      field_name: change.field,
      old_value: change.oldValue,
      new_value: change.newValue,
      diff_summary: diffSummary,
    });
  }
}

/**
 * Helper function to track admission view activity
 * 
 * @param admissionId - Admission UUID
 * @param userContext - User context
 */
async function trackAdmissionView(
  admissionId: string,
  userContext?: UserContext
): Promise<void> {
  try {
    const { create } = await import('@domain/user-activity/services/user-activity.service');
    const { ACTIVITY_TYPE, USER_TYPE } = await import('@config/constants');
    const { ENTITY_TYPES } = await import('@domain/user-activity/constants/user-activity.constants');

    // Map guest role to student for activity tracking
    const userType = userContext?.role === 'guest' 
      ? USER_TYPE.STUDENT 
      : (userContext?.role as any) || USER_TYPE.STUDENT;

    await create({
      user_id: userContext?.id || null,
      user_type: userType,
      activity_type: ACTIVITY_TYPE.VIEWED,
      entity_type: ENTITY_TYPES.ADMISSION,
      entity_id: admissionId,
      metadata: null,
    });
  } catch (error) {
    // Silently fail - activity tracking should not break the request
    console.error('Failed to track admission view:', error);
  }
}

/**
 * Helper function to create notification when admission is verified
 * 
 * @param admission - Verified admission
 */
async function createNotificationForVerification(admission: Admission): Promise<void> {
  try {
    const { create } = await import('@domain/notifications/services/notifications.service');
    const { NOTIFICATION_CATEGORY, NOTIFICATION_PRIORITY, USER_TYPE } = await import('@config/constants');

    await create({
      user_id: admission.created_by,
      user_type: USER_TYPE.UNIVERSITY,
      category: NOTIFICATION_CATEGORY.VERIFICATION,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: 'Admission Verified',
      message: `Your admission "${admission.title}" has been verified and is now visible to students.`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
    });
  } catch (error) {
    // Silently fail - notification should not break the request
    console.error('Failed to create verification notification:', error);
  }
}

/**
 * Helper function to create notification when admission is rejected
 * 
 * @param admission - Rejected admission
 * @param rejectionReason - Rejection reason
 */
async function createNotificationForRejection(
  admission: Admission,
  rejectionReason: string
): Promise<void> {
  try {
    const { create } = await import('@domain/notifications/services/notifications.service');
    const { NOTIFICATION_CATEGORY, NOTIFICATION_PRIORITY, USER_TYPE } = await import('@config/constants');

    await create({
      user_id: admission.created_by,
      user_type: USER_TYPE.UNIVERSITY,
      category: NOTIFICATION_CATEGORY.VERIFICATION,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: 'Admission Rejected',
      message: `Your admission "${admission.title}" has been rejected. Reason: ${rejectionReason}`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
    });
  } catch (error) {
    // Silently fail - notification should not break the request
    console.error('Failed to create rejection notification:', error);
  }
}

/**
 * Helper function to create notification when admission is disputed
 * 
 * @param admission - Disputed admission
 * @param disputeReason - Dispute reason
 */
async function createNotificationForDispute(
  admission: Admission,
  disputeReason: string
): Promise<void> {
  try {
    const { create } = await import('@domain/notifications/services/notifications.service');
    const { NOTIFICATION_CATEGORY, NOTIFICATION_PRIORITY, USER_TYPE } = await import('@config/constants');

    // Notify admin about dispute (user_id is null for admin notifications)
    await create({
      user_id: null,
      user_type: USER_TYPE.ADMIN,
      category: NOTIFICATION_CATEGORY.VERIFICATION,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: 'Admission Disputed',
      message: `Admission "${admission.title}" has been disputed by university. Reason: ${disputeReason}`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
    });
  } catch (error) {
    // Silently fail - notification should not break the request
    console.error('Failed to create dispute notification:', error);
  }
}
