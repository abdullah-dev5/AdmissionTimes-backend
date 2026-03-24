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
  UserContext,
} from '../types/admissions.types';
import { query } from '@db/connection';
import { CHANGE_TYPE, NOTIFICATION_PRIORITY, NOTIFICATION_TYPE, USER_TYPE, VERIFICATION_STATUS, type UserType, DEADLINE_TYPE } from '@config/constants';
import * as deadlinesModel from '../../deadlines/models/deadlines.model';

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
  const effectiveFilters = await applyAccessControl(filters, userContext);

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
  // Ensure university_id is always set for university users
  let universityId = data.university_id;
  
  // If university_id is not provided and user is a university, use their university_id from context
  if (!universityId && userContext?.role === 'university' && userContext?.university_id) {
    universityId = userContext.university_id;
    console.log(`🟢 [admissionsService] Using user's university_id for new admission: ${universityId}`);
  }

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
    university_id: universityId || null,
    verified_at: null,
    verified_by: null,
    rejection_reason: null,
    created_by: null, // Will be set by model from second parameter
    is_active: true,
  };

  const admission = await admissionsModel.create(admissionData, userContext?.id || null);

  // Create deadline record in deadlines table if deadline is set
  if (admission.deadline) {
    console.log(`🕒 [CREATE] Creating deadline record for admission ${admission.id}`);
    deadlinesModel.create({
      admission_id: admission.id,
      deadline_type: DEADLINE_TYPE.APPLICATION,
      deadline_date: admission.deadline,
    }).catch((err) => {
      console.error('❌ [CREATE] Failed to create deadline record:', err?.message || err);
    });
  }

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

  // Create notification for admins
  if (admission.created_by) {
    createNotificationForSubmission(admission).catch((err) => {
      console.error('📢 Failed to create submission notification:', err?.message || err);
    });
  }

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

  // Update admission - allow updates to pending and verified admissions
  const updated = await admissionsModel.update(id, data);

  if (!updated) {
    throw new AppError('Failed to update admission', 500);
  }

  // Sync deadline records when admission deadline changes
  if (existing.deadline !== updated.deadline) {
    console.log(`🕒 [UPDATE] Deadline changed for admission ${id}: ${existing.deadline} -> ${updated.deadline}`);
    
    if (updated.deadline) {
      // Find existing deadline record for this admission
      const existingDeadlines = await deadlinesModel.findByAdmissionId(id);
      
      if (existingDeadlines.length > 0) {
        // Update the first (primary) deadline record
        console.log(`🕒 [UPDATE] Updating existing deadline record ${existingDeadlines[0].id}`);
        deadlinesModel.update(existingDeadlines[0].id, {
          deadline_date: updated.deadline,
          reminder_sent: false, // Reset reminder flags when deadline changes
        }).catch((err) => {
          console.error('❌ [UPDATE] Failed to update deadline record:', err?.message || err);
        });
      } else {
        // Create new deadline record if none exists
        console.log(`🕒 [UPDATE] Creating new deadline record for admission ${id}`);
        deadlinesModel.create({
          admission_id: id,
          deadline_type: DEADLINE_TYPE.APPLICATION,
          deadline_date: updated.deadline,
        }).catch((err) => {
          console.error('❌ [UPDATE] Failed to create deadline record:', err?.message || err);
        });
      }
    } else {
      // Deadline was removed - optionally delete deadline records or mark as inactive
      console.log(`🕒 [UPDATE] Deadline removed for admission ${id}`);
    }
  }

  // Create changelog entries for changed fields
  await createChangelogForUpdate(existing, updated, userContext);

  // Send notifications based on admission status
  // Only notify watchlist students if admission is CURRENTLY VERIFIED
  // This ensures notifications are only sent for verified admissions, not pending ones
  if (updated.verification_status === VERIFICATION_STATUS.VERIFIED) {
    createNotificationForVerifiedAdmissionUpdate(updated).catch((err) => {
      console.error('📢 Failed to notify students of admission update:', err);
    });
  }

  // Notify admins if admission was updated and is now PENDING (for re-verification)
  if (existing.verification_status !== VERIFICATION_STATUS.PENDING && updated.verification_status === VERIFICATION_STATUS.PENDING) {
    createNotificationForSubmission(updated).catch((err) => {
      console.error('📢 Failed to notify admins of admission re-submission:', err);
    });
  }

  if (existing.verification_status === VERIFICATION_STATUS.PENDING && updated.verification_status === VERIFICATION_STATUS.PENDING) {
    // Pending admission was updated → notify admins
    createNotificationForPendingAdmissionUpdate(updated).catch((err) => {
      console.error('📢 Failed to notify admins of admission update:', err);
    });
  }

  if (existing.verification_status === VERIFICATION_STATUS.REJECTED && updated.verification_status === VERIFICATION_STATUS.REJECTED) {
    // Rejected admission was updated (university is challenging rejection) → notify admins
    createNotificationForRejectedAdmissionUpdate(updated).catch((err) => {
      console.error('📢 Failed to notify admins of rejected admission update:', err);
    });
  }

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
  console.log(`[VERIFY-START] verify() called for admission: ${id}`);
  const existing = await admissionsModel.findById(id, true);

  if (!existing) {
    throw new AppError('Admission not found', 404);
  }

  // Warn if admission has no creator
  if (!existing.created_by) {
    console.warn(`⚠️ [VERIFY] Admission ${id} has no created_by - notification will be skipped`);
    console.warn(`⚠️ [VERIFY] Admission details:`, { id, title: existing.title, university_id: existing.university_id });
  } else {
    console.log(`✅ [VERIFY] Admission ${id} has created_by: ${existing.created_by}`);
  }

  // Only pending admissions can be verified
  if (existing.verification_status !== VERIFICATION_STATUS.PENDING) {
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
    console.log(`📢 [VERIFY] Calling createNotificationForVerification for admission ${updated.id}`);
    createNotificationForVerification(updated).catch((error) => {
      console.error('❌ [VERIFY] Failed to create verification notification:', error?.message || error);
      if (error?.constraint) console.error('   Constraint violation:', error.constraint);
      if (error?.code) console.error('   Error code:', error.code);
    });
  } else {
    console.warn(`⚠️ [VERIFY] Skipping notification - no created_by for admission ${updated.id}`);
  }

  // Notify students who saved this admission in watchlist.
  // This covers re-verification flow: verified -> pending (edited) -> verified.
  createNotificationForVerifiedAdmissionUpdate(updated).catch((error) => {
    console.error('❌ [VERIFY] Failed to notify watchlist students after verification:', error?.message || error);
    if (error?.code) console.error('   Error code:', error.code);
  });

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
    console.log(`📢 [REJECT] Calling createNotificationForRejection for admission ${updated.id}`);
    createNotificationForRejection(updated, data.rejection_reason).catch((error) => {
      console.error('❌ [REJECT] Failed to create rejection notification:', error?.message || error);
      if (error?.constraint) console.error('   Constraint violation:', error.constraint);
      if (error?.code) console.error('   Error code:', error.code);
    });
  } else {
    console.warn(`⚠️ [REJECT] Skipping notification - no created_by for admission ${updated.id}`);
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

  // Notify admins about the submission
  createNotificationForSubmission(updated).catch((err) => {
    console.error('📢 Failed to create submission notification for pending admission:', err?.message || err);
  });

  return updated;
};

/**
 * Delete an admission (soft delete)
 * 
 * @param id - Admission UUID
 * @param userContext - User context
 * @returns Deleted admission record
 * @throws AppError if cannot be deleted
 */
export const remove = async (
  id: string,
  userContext?: UserContext
): Promise<Admission> => {
  const existing = await admissionsModel.findById(id, true);

  if (!existing) {
    throw new AppError('Admission not found', 404);
  }

  // Access control: only admin or owning university
  if (!userContext || userContext.role === 'guest' || userContext.role === 'student') {
    throw new AppError('Forbidden', 403);
  }

  if (userContext.role === 'university') {
    const isOwner = existing.created_by === userContext.id || existing.university_id === userContext.university_id;
    if (!isOwner) {
      throw new AppError('Admission not found', 404);
    }
  }

  const deleted = await admissionsModel.deleteById(id);

  if (!deleted) {
    throw new AppError('Admission not found', 404);
  }

  await createChangelogEntry({
    admission_id: deleted.id,
    actor_type: userContext.role === 'admin' ? 'admin' : 'university',
    changed_by: userContext.id || null,
    action_type: CHANGE_TYPE.UPDATED,
    field_name: 'is_active',
    old_value: true,
    new_value: false,
    diff_summary: 'Admission deactivated (soft delete)',
  });

  return deleted;
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
  limit: number,
  userContext?: UserContext
): Promise<{ changelogs: any[]; total: number }> => {
  if (!userContext || userContext.role === 'guest' || userContext.role === 'student') {
    throw new AppError('Forbidden: changelog access is restricted', 403);
  }

  // Verify admission exists
  const admission = await admissionsModel.findById(admissionId);
  if (!admission) {
    throw new AppError('Admission not found', 404);
  }

  if (userContext.role === 'university') {
    let universityScopeId = userContext.university_id || null;
    if (!universityScopeId) {
      const scopedUser = await query(
        'SELECT university_id::text as university_id FROM users WHERE id = $1 LIMIT 1',
        [userContext.id]
      );
      universityScopeId = scopedUser.rows[0]?.university_id || null;
    }

    if (!universityScopeId) {
      throw new AppError('Forbidden: university scope is missing', 403);
    }

    const ownerMatches =
      admission.university_id === universityScopeId ||
      (!admission.university_id &&
        !!admission.created_by &&
        !!(
          await query(
            'SELECT 1 FROM users WHERE id = $1 AND university_id = $2 LIMIT 1',
            [admission.created_by, universityScopeId]
          )
        ).rows.length);

    if (!ownerMatches) {
      throw new AppError('Forbidden: this admission does not belong to your university', 403);
    }
  }

  // Get changelogs (delegate to changelogs service/model)
  // For now, we'll implement a simple query here
  // In Phase 4, this should use changelogs service
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
async function applyAccessControl(
  filters: AdmissionFilters,
  userContext?: UserContext
): Promise<AdmissionFilters> {
  const effectiveFilters = { ...filters };

  // Public/Student: only verified admissions
  if (!userContext || userContext.role === 'guest' || userContext.role === 'student') {
    effectiveFilters.verification_status = VERIFICATION_STATUS.VERIFIED;
    effectiveFilters.is_active = true;
  }

  // University: expand scope to all linked identities (db user ID, auth ID, university ID)
  if (userContext?.role === 'university' && userContext.id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = (value?: string | null): value is string => !!value && uuidRegex.test(value);

    // Get this university user's full identity profile
    const baseUserSql = `
      SELECT id::text, auth_user_id::text, email, university_id::text
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const baseUserResult = await query(baseUserSql, [userContext.id]);
    const baseUser = baseUserResult.rows[0] || null;

    // Find all linked user records (same email/auth/organization)
    const linkedUsersSql = `
      SELECT id::text, auth_user_id::text, university_id::text
      FROM users
      WHERE role = 'university'
        AND (
          id = $1
          OR auth_user_id = $2
          OR ($3::text IS NOT NULL AND email = $3)
          OR ($4::uuid IS NOT NULL AND university_id = $4)
        )
    `;

    const linkedUsersResult = await query(linkedUsersSql, [
      userContext.id,
      baseUser?.auth_user_id || null,
      baseUser?.email || null,
      baseUser?.university_id || userContext.university_id || null,
    ]);

    const ownerUserIds = new Set<string>();
    const ownerUniversityIds = new Set<string>();

    // Add all identity variants
    if (isUuid(userContext.id)) ownerUserIds.add(userContext.id);
    if (isUuid(userContext.university_id)) ownerUniversityIds.add(userContext.university_id);
    if (isUuid(baseUser?.auth_user_id)) {
      ownerUserIds.add(baseUser.auth_user_id);
    }
    if (isUuid(baseUser?.university_id)) ownerUniversityIds.add(baseUser.university_id);

    for (const row of linkedUsersResult.rows) {
      if (isUuid(row.id)) ownerUserIds.add(row.id);
      if (isUuid(row.auth_user_id)) {
        ownerUserIds.add(row.auth_user_id);
      }
      if (isUuid(row.university_id)) ownerUniversityIds.add(row.university_id);
    }

    effectiveFilters.owner_user_ids = Array.from(ownerUserIds);
    effectiveFilters.owner_university_ids = Array.from(ownerUniversityIds);
    effectiveFilters.is_active = true;

    console.log('🟢 [admissionsService] Ownership scope resolved:', {
      userContext_id: userContext.id,
      userContext_university_id: userContext.university_id,
      baseUser: baseUser ? { id: baseUser.id, auth_user_id: baseUser.auth_user_id, email: baseUser.email } : null,
      linkedUsersCount: linkedUsersResult.rows.length,
      owner_user_ids: effectiveFilters.owner_user_ids,
      owner_university_ids: effectiveFilters.owner_university_ids,
    });
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
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');

    const { recipients, universityId } = await resolveUniversityRecipients(admission);

    if (!recipients.length) {
      console.warn(`⚠️ [NOTIFICATION] Skipping verification notification - no university recipients found for admission ${admission.id}`);
      return;
    }

    console.log(`📢 [NOTIFICATION] Creating verification notification for admission ${admission.id}`);
    console.log(`   → Recipients: ${recipients.length} university users`);
    if (universityId) {
      console.log(`   → University ID: ${universityId}`);
    }
    console.log(`   → Title: ${admission.title}`);
    
    const eventKey = `admission_verified:${admission.id}:${universityId || admission.created_by || 'unknown'}:${Date.now()}`;
    console.log(`   → Event key: ${eventKey}`);

    const result = await publishNotification({
      recipients,
      notification_type: NOTIFICATION_TYPE.ADMISSION_VERIFIED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: 'Admission Verified',
      message: `Your admission "${admission.title}" has been verified and is now visible to students.`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
      event_key: eventKey,
    });

    console.log(`✅ [NOTIFICATION] Successfully sent verification notification:`, result);
  } catch (error: any) {
    // Silently fail - notification should not break the request
    console.error(`❌ [NOTIFICATION] Failed to create verification notification for admission ${admission.id}:`);
    console.error(`   → Error: ${error?.message || String(error)}`);
    if (error?.code) console.error(`   → Code: ${error.code}`);
    if (error?.constraint) console.error(`   → Constraint: ${error.constraint}`);
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
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');

    const { recipients, universityId } = await resolveUniversityRecipients(admission);

    console.log(`📢 [NOTIFICATION] Creating rejection notification for admission ${admission.id}`);
    console.log(`   → Recipients: ${recipients.length} university users`);
    if (universityId) {
      console.log(`   → University ID: ${universityId}`);
    }
    console.log(`   → Title: ${admission.title}`);
    console.log(`   → Reason: ${rejectionReason}`);

    if (!recipients.length) {
      console.warn(`⚠️ [NOTIFICATION] Skipping rejection notification - no university recipients found for admission ${admission.id}`);
      return;
    }

    const eventKey = `admission_rejected:${admission.id}:${universityId || admission.created_by || 'unknown'}:${Date.now()}`;
    console.log(`   → Event key: ${eventKey}`);

    const result = await publishNotification({
      recipients,
      notification_type: NOTIFICATION_TYPE.ADMISSION_REJECTED,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: 'Admission Rejected',
      message: `Your admission "${admission.title}" has been rejected. Reason: ${rejectionReason}`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admissions/${admission.id}`,
      event_key: eventKey,
    });

    console.log(`✅ [NOTIFICATION] Successfully sent rejection notification:`, result);
  } catch (error: any) {
    // Silently fail - notification should not break the request
    console.error(`❌ [NOTIFICATION] Failed to create rejection notification for admission ${admission.id}:`);
    console.error(`   → Error: ${error?.message || String(error)}`);
    if (error?.code) console.error(`   → Code: ${error.code}`);
    if (error?.constraint) console.error(`   → Constraint: ${error.constraint}`);
  }
}

/**
 * Helper function to create notification when admission is submitted
 * 
 * @param admission - Created admission
 */
async function createNotificationForSubmission(admission: Admission): Promise<void> {
  try {
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');

    console.log(`📢 [NOTIFICATION] Starting submission notification for admission ${admission.id}`);
    console.log(`   → Created by: ${admission.created_by}`);
    console.log(`   → Title: ${admission.title}`);

    if (!admission.created_by) {
      console.warn(`⚠️ [NOTIFICATION] Skipping submission notification - no created_by for admission ${admission.id}`);
      return;
    }

    // Get all admins to notify
    console.log(`📢 [NOTIFICATION] Fetching admin recipients...`);
    const admins = await getAdminRecipients();
    console.log(`📢 [NOTIFICATION] Found ${admins.length} admins to notify:`, admins.map(a => a.id));

    if (admins.length === 0) {
      console.warn(`⚠️ [NOTIFICATION] No admins found to notify!`);
      return;
    }

    console.log(`📢 [NOTIFICATION] Publishing notification to ${admins.length} admins...`);
    const result = await publishNotification({
      recipients: admins,
      notification_type: NOTIFICATION_TYPE.ADMISSION_SUBMITTED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: 'New Admission Submitted',
      message: `"${admission.title}" has been submitted for verification`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admin/verify-admissions/${admission.id}`,
      event_key: `admission_submitted:${admission.id}:${admission.created_by}:${Date.now()}`,
    });
    
    console.log(`✅ [NOTIFICATION] Successfully published submission notification:`, {
      admins_notified: admins.length,
      notifications_created: result.length,
    });
  } catch (error: any) {
    // Silently fail - notification should not break the request
    console.error(`❌ [NOTIFICATION] Failed to create submission notification:`, error.message);
    console.error(`   → Stack trace:`, error.stack);
  }
}

/**
 * Helper function to create notification when verified admission is updated
 * Notifies students who have this admission in their watchlist/saved
 * 
 * @param admission - Updated verified admission
 */
async function createNotificationForVerifiedAdmissionUpdate(admission: Admission): Promise<void> {
  try {
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');
    const { query } = await import('@db/connection');

    console.log(`📢 [NOTIFICATION] Creating verified admission update notification for admission ${admission.id}`);
    console.log(`   → Title: ${admission.title}`);

    if (!admission.id) {
      console.warn(`⚠️ [NOTIFICATION] No admission ID provided for watchlist notification`);
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

    console.log(`✅ [NOTIFICATION] Successfully sent verified admission update notification to ${watchlistStudents.length} students:`, result2);
  } catch (error: any) {
    console.error(`❌ [NOTIFICATION] Failed to create verified admission update notification for admission ${admission.id}:`);
    console.error(`   → Error: ${error?.message || String(error)}`);
    if (error?.code) console.error(`   → Code: ${error.code}`);
  }
}

/**
 * Helper function to create notification when pending admission is updated
 * Notifies admins about the update
 * 
 * @param admission - Updated pending admission
 */
async function createNotificationForPendingAdmissionUpdate(admission: Admission): Promise<void> {
  try {
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');
    const updaterDisplayName = await resolveAdmissionUpdaterDisplayName(admission);

    console.log(`📢 [NOTIFICATION] Creating pending admission update notification for admission ${admission.id}`);
    console.log(`   → Title: ${admission.title}`);
    console.log(`   → Created by: ${admission.created_by}`);

    if (!admission.id || !admission.created_by) {
      console.warn(`⚠️ [NOTIFICATION] Skipping pending update notification - missing ID (${admission.id}) or created_by (${admission.created_by})`);
      return;
    }

    // Get all admins to notify
    console.log(`   → Fetching admin recipients...`);
    const admins = await getAdminRecipients();
    console.log(`   → Found ${admins.length} admins to notify`);

    if (admins.length === 0) {
      console.warn(`⚠️ [NOTIFICATION] No admins found to notify about pending admission update!`);
      return;
    }

    const eventKey = `admission_updated:${admission.id}:pending:${admission.created_by}:${Date.now()}`;
    console.log(`   → Event key: ${eventKey}`);

    const result = await publishNotification({
      recipients: admins,
      notification_type: NOTIFICATION_TYPE.ADMISSION_UPDATED_SAVED,
      priority: NOTIFICATION_PRIORITY.LOW,
      title: `${admission.title} Updated`,
      message: `A pending admission has been updated by ${updaterDisplayName}. Review changes in verification panel.`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admin/verify-admissions/${admission.id}`,
      event_key: eventKey,
    });

    console.log(`✅ [NOTIFICATION] Successfully sent pending admission update notification:`, result);

async function resolveAdmissionUpdaterDisplayName(admission: Admission): Promise<string> {
  try {
    const result = await query(
      `SELECT
         COALESCE(univ.name, user_univ.name, u.display_name, u.email, 'the university') AS updater_name
       FROM admissions a
       LEFT JOIN universities univ ON univ.id = a.university_id
       LEFT JOIN users u ON u.id = a.created_by
       LEFT JOIN universities user_univ ON user_univ.id = u.university_id
       WHERE a.id = $1
       LIMIT 1`,
      [admission.id]
    );

    return result.rows[0]?.updater_name || 'the university';
  } catch (error: any) {
    console.warn(
      `⚠️ [NOTIFICATION] Failed to resolve updater display name for admission ${admission.id}:`,
      error?.message || error
    );
    return 'the university';
  }
}
  } catch (error: any) {
    console.error(`❌ [NOTIFICATION] Failed to create pending admission update notification for admission ${admission.id}:`);
    console.error(`   → Error: ${error?.message || String(error)}`);
    if (error?.code) console.error(`   → Code: ${error.code}`);
  }
}

/**
 * Helper function to create notification when rejected admission is updated
 * Notifies admins about the update (university is challenging the rejection)
 * 
 * @param admission - Updated rejected admission
 */
async function createNotificationForRejectedAdmissionUpdate(admission: Admission): Promise<void> {
  try {
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');

    console.log(`📢 [NOTIFICATION] Creating rejected admission update notification for admission ${admission.id}`);
    console.log(`   → Title: ${admission.title}`);
    console.log(`   → Created by: ${admission.created_by}`);

    if (!admission.id || !admission.created_by) {
      console.warn(`⚠️ [NOTIFICATION] Skipping rejected update notification - missing ID (${admission.id}) or created_by (${admission.created_by})`);
      return;
    }

    // Get all admins to notify
    console.log(`   → Fetching admin recipients...`);
    const admins = await getAdminRecipients();
    console.log(`   → Found ${admins.length} admins to notify`);

    if (admins.length === 0) {
      console.warn('⚠️ [NOTIFICATION] No admins found to notify about rejected admission update');
      return;
    }

    const eventKey = `admission_updated:${admission.id}:rejected:${admission.created_by}:${Date.now()}`;
    console.log(`   → Event key: ${eventKey}`);

    const result = await publishNotification({
      recipients: admins,
      notification_type: NOTIFICATION_TYPE.ADMISSION_UPDATED_SAVED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: `${admission.title} Resubmitted`,
      message: `A rejected admission has been resubmitted by university. Review the updated details and rejection reason.`,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admin/verify-admissions/${admission.id}`,
      event_key: eventKey,
    });

    console.log(`✅ [NOTIFICATION] Successfully sent rejected admission update notification:`, result);
  } catch (error: any) {
    console.error(`❌ [NOTIFICATION] Failed to create rejected admission update notification for admission ${admission.id}:`);
    console.error(`   → Error: ${error?.message || String(error)}`);
    if (error?.code) console.error(`   → Code: ${error.code}`);
  }
}

async function getAdminRecipients() {
  console.log(`🔍 [NOTIFICATION] Querying database for admin users...`);
  const sql = `
    SELECT id::text as id, role, email
    FROM users
    WHERE role = 'admin'
  `;
  const result = await query(sql, []);
  console.log(`🔍 [NOTIFICATION] Admin query result: ${result.rows.length} admins found`);
  if (result.rows.length > 0) {
    console.log(`   → Admins:`, result.rows.map(r => ({ id: r.id, email: r.email })));
  } else {
    console.warn(`⚠️ [NOTIFICATION] No admin users found in database!`);
  }
  return result.rows.map((row) => ({ id: row.id as string, role: USER_TYPE.ADMIN }));
}

async function resolveUniversityRecipients(admission: Admission): Promise<{ recipients: Array<{ id: string; role: UserType }>; universityId?: string | null }> {
  let universityId = admission.university_id || null;

  if (!universityId && admission.created_by) {
    const orgResult = await query(
      'SELECT university_id::text as university_id FROM users WHERE id = $1',
      [admission.created_by]
    );
    universityId = orgResult.rows[0]?.university_id || null;

    if (universityId) {
      try {
        await admissionsModel.update(admission.id, { university_id: universityId });
        admission.university_id = universityId;
        console.log(`🟢 [admissionsService] Backfilled university_id for admission ${admission.id}: ${universityId}`);
      } catch (error: any) {
        console.warn(`⚠️ [admissionsService] Failed to backfill university_id for admission ${admission.id}:`, error?.message || error);
      }
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
