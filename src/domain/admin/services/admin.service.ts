/**
 * Admin Domain - Service Layer
 *
 * Single moderation path for admission verification decisions. Every decision
 * is applied atomically with its changelog and audit entries, then the
 * university (and, on verification, watching students) are notified.
 */

import { randomInt } from 'crypto';
import { AppError } from '@shared/middleware/errorHandler';
import { withTransaction } from '@db/connection';
import { CHANGE_TYPE, USER_TYPE, VerificationStatus } from '@config/constants';
import { withAdmissionContract } from '@shared/utils/admissionContract';
import { getSupabaseAdminClient } from '@shared/supabase/clients';
import { invalidateAuthCache } from '@shared/middleware/jwtAuth';
import { createLogger } from '@shared/utils/logger';
import * as adminModel from '../models/admin.model';
import {
  AdminVerifyAdmissionDTO,
  AdminBulkVerifyDTO,
  AdminCreateUniversityRepDTO,
  AdminCreateUniversityRepResponse,
  AdminFilterParams,
  UserContext,
  AdminAdmission,
  AdminDashboard,
} from '../types/admin.types';
import {
  recordChangelog,
  notifyUniversityOfDecision,
  notifyWatchersOfUpdate,
} from '@domain/admissions/services/admissionEvents';

const log = createLogger('AdminService');

/** Allowed moderation transitions (draft stays private to its university). */
const VALID_TRANSITIONS: Record<VerificationStatus, Array<'verified' | 'rejected'>> = {
  draft: [],
  pending: ['verified', 'rejected'],
  verified: ['rejected'],
  rejected: ['verified'],
};

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
  while (chars.length < 14) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const REDACTED_KEYS = new Set(['email', 'password', 'token', 'access_token', 'refresh_token', 'ip_address', 'user_agent', 'phone', 'contact_email', 'contact_phone']);

const redact = (input: any): any => {
  if (Array.isArray(input)) return input.map(redact);
  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(value)])
    );
  }
  return input;
};

const toActionLabel = (actionType: string | null | undefined): 'Verified' | 'Rejected' | 'Updated' => {
  const value = String(actionType || '').toLowerCase();
  if (value.includes('verify')) return 'Verified';
  if (value.includes('reject')) return 'Rejected';
  return 'Updated';
};

const normalizeAdminAdmission = (admission: any): AdminAdmission => {
  const normalized = withAdmissionContract(admission || {}) as any;
  return {
    ...normalized,
    admission_title: normalized.admission_title || normalized.title || 'Unknown',
    submitted_on: normalized.submitted_on || normalized.updated_at || normalized.created_at || null,
    submitted_by_label: normalized.submitted_by_label || 'University',
    status_label: normalized.status_label === 'Pending' ? 'Pending Audit' : normalized.status_label || 'Pending Audit',
  } as AdminAdmission;
};

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export const verifyAdmission = async (
  admissionId: string,
  data: AdminVerifyAdmissionDTO,
  admin: UserContext
): Promise<AdminAdmission> => {
  const target = data.verification_status;
  if (target === 'rejected' && !data.rejection_reason?.trim()) {
    throw new AppError('Rejection reason is required', 400, true, { rejection_reason: 'Rejection reason is required' });
  }

  const { before, after } = await withTransaction(async (db) => {
    const current = await adminModel.lockAdmission(db, admissionId);
    const from = current.verification_status;

    if (!VALID_TRANSITIONS[from]?.includes(target)) {
      throw new AppError(`Cannot change an admission from ${from} to ${target}`, 409);
    }

    const updated = await adminModel.applyModeration(db, admissionId, {
      verification_status: target,
      admin_id: admin.id,
      rejection_reason: data.rejection_reason?.trim() || null,
      admin_notes: data.admin_notes || null,
      verification_comments: data.verification_comments || null,
    });

    await recordChangelog(
      {
        admission_id: admissionId,
        actor_type: 'admin',
        changed_by: admin.id,
        action_type: target === 'verified' ? CHANGE_TYPE.VERIFIED : CHANGE_TYPE.REJECTED,
        field_name: 'verification_status',
        old_value: from,
        new_value: target,
        diff_summary: target === 'verified' ? 'Admission verified by admin' : `Admission rejected: ${data.rejection_reason}`,
        metadata: {
          rejection_reason: data.rejection_reason || null,
          admin_notes: data.admin_notes || null,
          was_reverification: !!current.needs_reverification,
        },
      },
      db
    );

    await adminModel.createAuditLog(
      {
        admin_id: admin.id,
        action_type: target === 'verified' ? 'verify' : 'reject',
        entity_type: 'admission',
        entity_id: admissionId,
        old_values: { verification_status: from },
        new_values: { verification_status: target },
        reason: data.rejection_reason || data.admin_notes || null,
        created_by: admin.email || 'admin',
      },
      db
    );

    return { before: current, after: updated };
  });

  void notifyUniversityOfDecision(after, target, data.rejection_reason);
  if (target === 'verified' && before.verification_status !== 'verified') {
    void notifyWatchersOfUpdate(after);
  }

  return normalizeAdminAdmission({ ...after, university_name: (before as any).university_name });
};

/**
 * Ask the university to revise a pending/rejected admission. The admission
 * returns to the university as rejected-with-notes so it can edit and resubmit.
 */
export const requestRevision = async (admissionId: string, reason: string, admin: UserContext): Promise<AdminAdmission> => {
  const updated = await withTransaction(async (db) => {
    const current = await adminModel.lockAdmission(db, admissionId);
    if (!['pending', 'rejected'].includes(current.verification_status)) {
      throw new AppError(`Cannot request revision for an admission that is ${current.verification_status}`, 409);
    }

    const row = await adminModel.applyModeration(db, admissionId, {
      verification_status: 'rejected',
      admin_id: admin.id,
      rejection_reason: `Revision requested: ${reason}`,
      admin_notes: reason,
      verification_comments: reason,
    });

    await recordChangelog(
      {
        admission_id: admissionId,
        actor_type: 'admin',
        changed_by: admin.id,
        action_type: CHANGE_TYPE.STATUS_CHANGED,
        field_name: 'verification_status',
        old_value: current.verification_status,
        new_value: 'rejected',
        diff_summary: 'Revision requested by admin',
        metadata: { admin_notes: reason },
      },
      db
    );

    await adminModel.createAuditLog(
      {
        admin_id: admin.id,
        action_type: 'update_notes',
        entity_type: 'admission',
        entity_id: admissionId,
        old_values: { verification_status: current.verification_status },
        new_values: { verification_status: 'rejected', revision_requested: true },
        reason,
        created_by: admin.email || 'admin',
      },
      db
    );

    return row;
  });

  void notifyUniversityOfDecision(updated, 'revision_required', reason);
  return normalizeAdminAdmission(updated);
};

export const bulkVerifyAdmissions = async (
  data: AdminBulkVerifyDTO,
  admin: UserContext
): Promise<{ succeeded: AdminAdmission[]; failed: Array<{ id: string; error: string }> }> => {
  const succeeded: AdminAdmission[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const admissionId of Array.from(new Set(data.admission_ids))) {
    try {
      succeeded.push(
        await verifyAdmission(
          admissionId,
          { verification_status: data.verification_status, rejection_reason: data.rejection_reason, admin_notes: data.admin_notes },
          admin
        )
      );
    } catch (error) {
      failed.push({ id: admissionId, error: (error as Error)?.message || 'Unknown error' });
    }
  }

  log.info(`Bulk ${data.verification_status}: ${succeeded.length} ok, ${failed.length} failed`);
  return { succeeded, failed };
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getPendingAdmissions = async (filters: AdminFilterParams, limit: number, offset: number) => {
  const { rows, total } = await adminModel.listAdmissions({ ...filters, status: 'pending' }, limit, offset);
  return { data: rows.map(normalizeAdminAdmission), total };
};

export const getAllAdmissions = async (filters: AdminFilterParams, limit: number, offset: number) => {
  const { rows, total } = await adminModel.listAdmissions(filters, limit, offset);
  return { data: rows.map(normalizeAdminAdmission), total };
};

export const getAdminDashboard = async (): Promise<AdminDashboard> => {
  const [stats, pending, recentActions] = await Promise.all([
    adminModel.getDashboardStats(),
    adminModel.listAdmissions({ status: 'pending', sort: 'updated_at', order: 'desc' }, 5, 0),
    adminModel.getRecentActions(10),
  ]);

  return {
    stats,
    pending_verifications: pending.rows.map(normalizeAdminAdmission),
    recent_actions: recentActions.map((entry) => ({
      ...entry,
      ip_address: null,
      user_agent: null,
      old_values: redact(entry.old_values),
      new_values: redact(entry.new_values),
      created_by: entry.created_by ? 'admin' : 'System',
      changed_at_iso: entry.created_at || undefined,
      admission_title: entry.admission_title || 'Unknown',
      action_label: toActionLabel(entry.action_type),
      changed_by_label: entry.created_by ? 'Admin' : 'System',
    })),
  };
};

export const getAdmissionDetails = async (admissionId: string): Promise<AdminAdmission> =>
  normalizeAdminAdmission(await adminModel.getAdmissionById(admissionId));

// ---------------------------------------------------------------------------
// University representatives
// ---------------------------------------------------------------------------

/**
 * Provision a university representative.
 *
 * Attaches to an existing university (by id, or by exact name) instead of
 * creating duplicates. Credentials live only in Supabase Auth; the temporary
 * password is returned once for hand-over and never stored by this API.
 */
export const createUniversityRep = async (
  data: AdminCreateUniversityRepDTO,
  admin: UserContext
): Promise<AdminCreateUniversityRepResponse> => {
  const email = data.email.trim().toLowerCase();
  const displayName = data.display_name.trim();

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    throw new AppError('Supabase service role is not configured', 503);
  }

  const temporaryPassword = buildTemporaryPassword();
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (authError || !authData.user?.id) {
    const duplicate = authError?.message?.toLowerCase().includes('already');
    throw new AppError(duplicate ? 'A user with this email already exists' : authError?.message || 'Failed to create auth user', duplicate ? 409 : 400);
  }

  const authUserId = authData.user.id;

  try {
    const result = await withTransaction(async (db) => {
      const existingUser = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
      if (existingUser.rows.length) throw new AppError('A user with this email already exists', 409);

      let university = data.university_id
        ? await adminModel.findUniversityById(db, data.university_id)
        : data.university_name
          ? await adminModel.findUniversityByName(db, data.university_name)
          : null;

      if (data.university_id && !university) throw new AppError('University not found', 404);

      let createdUniversity = false;
      if (!university) {
        if (!data.university_name?.trim()) {
          throw new AppError('university_id or university_name is required', 400);
        }
        const inserted = await db.query(
          `INSERT INTO universities (name, city, country, website, is_active)
           VALUES ($1, $2, $3, $4, true)
           RETURNING id::text AS id, name`,
          [data.university_name.trim(), data.city?.trim() || null, data.country?.trim() || null, data.website?.trim() || null]
        );
        university = inserted.rows[0];
        createdUniversity = true;
      }

      const userResult = await db.query(
        `INSERT INTO users (auth_user_id, email, role, display_name, university_id, status)
         VALUES ($1, $2, 'university', $3, $4, 'active')
         RETURNING id::text AS id, email, display_name, university_id::text AS university_id`,
        [authUserId, email, displayName, university!.id]
      );
      const user = userResult.rows[0];

      await adminModel.createAuditLog(
        {
          admin_id: admin.id,
          action_type: 'update_notes',
          entity_type: 'user',
          entity_id: user.id,
          new_values: { role: 'university', university_id: university!.id, created_university: createdUniversity },
          reason: 'Admin created university representative',
          created_by: admin.email || 'admin',
        },
        db
      );

      return { user, university: university!, createdUniversity };
    });

    invalidateAuthCache(authUserId);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        role: USER_TYPE.UNIVERSITY,
        university_id: result.user.university_id,
        display_name: result.user.display_name,
      },
      university: { id: result.university.id, name: result.university.name, created: result.createdUniversity },
      credentials: { temporary_password: temporaryPassword, show_once: true },
    };
  } catch (error) {
    // Roll back the auth identity so the email can be retried.
    await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    throw error;
  }
};
