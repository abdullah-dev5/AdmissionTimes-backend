/**
 * Admissions Domain - Service Layer
 *
 * Authorization
 * - Students/guests read verified admissions (plus admissions they saved).
 * - University representatives manage admissions of THEIR university only.
 * - Admins manage everything. Verification decisions go through the admin
 *   moderation service (single source of truth for verify/reject).
 *
 * Workflow (verification_status)
 *   draft ──submit──▶ pending ──admin──▶ verified | rejected
 *   rejected ──edit + submit──▶ pending
 *   verified ──material edit by university──▶ pending (needs_reverification)
 * Clients never write the status directly; they express intent
 * ('draft' = keep private, 'pending' = submit for review).
 */

import { AppError } from '@shared/middleware/errorHandler';
import { withTransaction } from '@db/connection';
import { VERIFICATION_STATUS, CHANGE_TYPE, USER_TYPE } from '@config/constants';
import { withAdmissionContract } from '@shared/utils/admissionContract';
import { createLogger } from '@shared/utils/logger';
import * as admissionsModel from '../models/admissions.model';
import { CONTENT_COLUMNS, type AdmissionContent, type ContentColumn } from '../models/admissions.model';
import {
  Admission,
  CreateAdmissionDTO,
  UpdateAdmissionDTO,
  AdmissionQueryParams,
  AdmissionFilters,
  UserContext,
} from '../types/admissions.types';
import {
  actorFor,
  recordChangelog,
  notifyAdminsOfSubmission,
  notifyWatchersOfUpdate,
  type ChangelogEntry,
} from './admissionEvents';

const log = createLogger('Admissions');

type Manager = UserContext & { id: string; role: 'admin' | 'university' };

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

const isAdmin = (ctx?: UserContext): boolean => ctx?.role === USER_TYPE.ADMIN;

/** Ensure the caller may create/manage admissions at all. */
const requireManager = (ctx?: UserContext): Manager => {
  if (!ctx?.id) throw new AppError('Authentication required', 401);
  if (ctx.role === USER_TYPE.ADMIN) return ctx as Manager;
  if (ctx.role === USER_TYPE.UNIVERSITY) {
    if (!ctx.university_id) {
      throw new AppError('Your account is not linked to a university. Contact an administrator.', 403);
    }
    return ctx as Manager;
  }
  throw new AppError('Only university representatives and admins can manage admissions', 403);
};

/** University reps may only touch their own university's admissions. */
const assertOwnership = (admission: Admission, manager: Manager): void => {
  if (manager.role === USER_TYPE.ADMIN) return;
  if (admission.university_id !== manager.university_id) {
    // 404 rather than 403 so ids of other universities are not confirmed.
    throw new AppError('Admission not found', 404);
  }
};

const loadManaged = async (id: string, manager: Manager): Promise<Admission> => {
  const admission = await admissionsModel.findById(id);
  if (!admission) throw new AppError('Admission not found', 404);
  assertOwnership(admission, manager);
  return admission;
};

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

const normalizeForCompare = (column: ContentColumn, value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (column === 'deadline' || column === 'start_date') {
    const time = new Date(value as string).getTime();
    return Number.isNaN(time) ? String(value) : String(time);
  }
  if (column === 'tuition_fee' || column === 'application_fee') return String(Number(value));
  if (column === 'requirements') return JSON.stringify(value);
  return String(value).trim();
};

const diffContent = (existing: Admission, incoming: AdmissionContent): ContentColumn[] =>
  CONTENT_COLUMNS.filter(
    (column) =>
      incoming[column] !== undefined &&
      normalizeForCompare(column, incoming[column]) !== normalizeForCompare(column, (existing as any)[column])
  );

const pickContent = (data: CreateAdmissionDTO | UpdateAdmissionDTO): AdmissionContent => {
  const content: AdmissionContent = {};
  for (const column of CONTENT_COLUMNS) {
    const value = (data as Record<string, unknown>)[column];
    if (value !== undefined) content[column] = value === '' ? null : value;
  }
  return content;
};

const assertFutureDeadline = (deadline: unknown): void => {
  if (deadline === null || deadline === undefined) return;
  const time = new Date(deadline as string).getTime();
  if (Number.isNaN(time)) throw new AppError('Deadline must be a valid date', 400, true, { deadline: 'Invalid date' });
  if (time <= Date.now()) {
    throw new AppError('Deadline must be in the future', 400, true, { deadline: 'Deadline must be in the future' });
  }
};

const humanize = (field: string): string => field.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const fieldChangelogs = (
  before: Admission,
  after: Admission,
  fields: ContentColumn[],
  ctx: Manager
): ChangelogEntry[] =>
  fields.map((field) => {
    const oldValue = (before as any)[field] ?? null;
    const newValue = (after as any)[field] ?? null;
    const label = humanize(field);
    const summary =
      oldValue === null ? `${label} set` : newValue === null ? `${label} cleared` : `${label} changed`;
    return {
      admission_id: after.id,
      actor_type: actorFor(ctx.role),
      changed_by: ctx.id,
      action_type: CHANGE_TYPE.UPDATED,
      field_name: field,
      old_value: oldValue,
      new_value: newValue,
      diff_summary: summary,
    };
  });

const statusChangelog = (admission: Admission, from: string, to: string, ctx: Manager, summary: string): ChangelogEntry => ({
  admission_id: admission.id,
  actor_type: actorFor(ctx.role),
  changed_by: ctx.id,
  action_type: CHANGE_TYPE.STATUS_CHANGED,
  field_name: 'verification_status',
  old_value: from,
  new_value: to,
  diff_summary: summary,
});

const present = (admission: Admission): Admission => withAdmissionContract(admission as any) as Admission;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getById = async (
  id: string,
  ctx?: UserContext,
  options: { trackView?: boolean } = {}
): Promise<Admission> => {
  const admission = await admissionsModel.findById(id);
  if (!admission) throw new AppError('Admission not found', 404);

  const isOwnerRep = ctx?.role === USER_TYPE.UNIVERSITY && !!ctx.university_id && admission.university_id === ctx.university_id;
  const isVerified = admission.verification_status === VERIFICATION_STATUS.VERIFIED;

  // Students keep access to programs they saved even while those are re-reviewed.
  const canRead =
    isAdmin(ctx) ||
    isOwnerRep ||
    isVerified ||
    (ctx?.role === USER_TYPE.STUDENT && !!ctx.id && (await admissionsModel.isWatchedBy(id, ctx.id)));

  if (!canRead) throw new AppError('Admission not found', 404);

  if (ctx?.id && options.trackView !== false) void trackAdmissionView(id, ctx);
  return present(admission);
};

/**
 * Translate client query params into filters the caller is allowed to use.
 */
const scopeFilters = (params: AdmissionQueryParams, ctx?: UserContext): AdmissionFilters => {
  const filters: AdmissionFilters = {
    search: params.search?.trim() || undefined,
    program_type: params.program_type || undefined,
    degree_level: params.degree_level || undefined,
    field_of_study: params.field_of_study || undefined,
    location: params.location || undefined,
    delivery_mode: params.delivery_mode || undefined,
    deadline_from: params.deadline_from || undefined,
    deadline_to: params.deadline_to || undefined,
  };

  if (isAdmin(ctx)) {
    return {
      ...filters,
      verification_status: params.verification_status,
      university_id: params.university_id,
      created_by: params.created_by,
      exclude_closed: params.include_closed === false,
    };
  }

  if (ctx?.role === USER_TYPE.UNIVERSITY) {
    if (!ctx.university_id) throw new AppError('Your account is not linked to a university', 403);
    return {
      ...filters,
      verification_status: params.verification_status,
      university_id: ctx.university_id,
    };
  }

  // Students, maintenance and guests: verified and still open (unless asked otherwise).
  return {
    ...filters,
    verification_status: VERIFICATION_STATUS.VERIFIED,
    exclude_closed: params.include_closed !== true,
  };
};

export const getMany = async (
  params: AdmissionQueryParams,
  page: number,
  limit: number,
  ctx?: UserContext
): Promise<{ admissions: Admission[]; total: number }> => {
  const filters = scopeFilters(params, ctx);
  const [rows, total] = await Promise.all([
    admissionsModel.findMany(filters, page, limit, params.sort, params.order),
    admissionsModel.count(filters),
  ]);
  return { admissions: rows.map(present), total };
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const create = async (data: CreateAdmissionDTO, ctx?: UserContext): Promise<Admission> => {
  const manager = requireManager(ctx);

  const universityId = manager.role === USER_TYPE.ADMIN ? data.university_id : manager.university_id!;
  if (!universityId) {
    throw new AppError('university_id is required', 400, true, { university_id: 'Select the university for this admission' });
  }
  if (manager.role === USER_TYPE.ADMIN && !(await admissionsModel.universityExists(universityId))) {
    throw new AppError('University not found', 400, true, { university_id: 'Unknown university' });
  }

  const content = pickContent(data);
  assertFutureDeadline(content.deadline);

  // Admin-authored admissions are trusted; university submissions need review.
  const status =
    manager.role === USER_TYPE.ADMIN
      ? VERIFICATION_STATUS.VERIFIED
      : data.verification_status === VERIFICATION_STATUS.PENDING
        ? VERIFICATION_STATUS.PENDING
        : VERIFICATION_STATUS.DRAFT;

  const admission = await withTransaction(async (db) => {
    const created = await admissionsModel.insert(db, {
      ...content,
      university_id: universityId,
      created_by: manager.id,
      verification_status: status,
      verified_by: status === VERIFICATION_STATUS.VERIFIED ? manager.id : null,
    });
    await admissionsModel.syncApplicationDeadline(db, created.id, created.deadline);
    await recordChangelog(
      {
        admission_id: created.id,
        actor_type: actorFor(manager.role),
        changed_by: manager.id,
        action_type: CHANGE_TYPE.CREATED,
        field_name: null,
        old_value: null,
        new_value: { title: created.title, verification_status: created.verification_status },
        diff_summary: status === VERIFICATION_STATUS.PENDING ? 'Admission created and submitted for verification' : 'Admission created',
      },
      db
    );
    return created;
  });

  if (status === VERIFICATION_STATUS.PENDING) void notifyAdminsOfSubmission(admission, 'submitted');

  const full = await admissionsModel.findById(admission.id);
  return present(full || admission);
};

export const update = async (id: string, data: UpdateAdmissionDTO, ctx?: UserContext): Promise<Admission> => {
  const manager = requireManager(ctx);
  const existing = await loadManaged(id, manager);

  const content = pickContent(data);
  const changedFields = diffContent(existing, content);
  if (changedFields.includes('deadline')) assertFutureDeadline(content.deadline);

  // Only persist columns that actually changed.
  const changes: AdmissionContent = {};
  changedFields.forEach((field) => (changes[field] = content[field]));

  const wantsSubmit = data.verification_status === VERIFICATION_STATUS.PENDING;
  const current = existing.verification_status;
  let nextStatus: string = current;
  let needsReverification: boolean | undefined;
  let event: 'submitted' | 'resubmitted' | 'updated_pending' | 'reverification' | 'watchers' | null = null;

  if (manager.role === USER_TYPE.ADMIN) {
    // Admin edits never change workflow state; watchers hear about live changes.
    if (current === VERIFICATION_STATUS.VERIFIED && changedFields.length) event = 'watchers';
  } else if (current === VERIFICATION_STATUS.DRAFT) {
    if (wantsSubmit) {
      nextStatus = VERIFICATION_STATUS.PENDING;
      event = 'submitted';
    }
  } else if (current === VERIFICATION_STATUS.REJECTED) {
    if (wantsSubmit) {
      nextStatus = VERIFICATION_STATUS.PENDING;
      event = 'resubmitted';
    }
  } else if (current === VERIFICATION_STATUS.PENDING) {
    if (changedFields.length) event = 'updated_pending';
  } else if (current === VERIFICATION_STATUS.VERIFIED && changedFields.length) {
    nextStatus = VERIFICATION_STATUS.PENDING;
    needsReverification = true;
    event = 'reverification';
  }

  if (!changedFields.length && nextStatus === current) {
    return present(existing);
  }

  const updated = await withTransaction(async (db) => {
    const row = await admissionsModel.updateContent(db, id, changes, {
      updated_by: manager.id,
      verification_status: nextStatus !== current ? nextStatus : undefined,
      needs_reverification: needsReverification,
    });
    if (!row) throw new AppError('Admission not found', 404);

    if (changedFields.includes('deadline')) {
      await admissionsModel.syncApplicationDeadline(db, id, row.deadline);
    }

    const entries = fieldChangelogs(existing, row, changedFields, manager);
    if (nextStatus !== current) {
      entries.push(
        statusChangelog(
          row,
          current,
          nextStatus,
          manager,
          event === 'reverification'
            ? 'Verified admission edited; re-verification required'
            : event === 'resubmitted'
              ? 'Rejected admission revised and resubmitted'
              : 'Admission submitted for verification'
        )
      );
    }
    await recordChangelog(entries, db);
    return row;
  });

  if (event === 'watchers') void notifyWatchersOfUpdate(updated);
  else if (event) void notifyAdminsOfSubmission(updated, event);

  const full = await admissionsModel.findById(id);
  return present(full || updated);
};

/**
 * Submit a draft (or a revised rejected admission) for verification.
 */
export const submit = async (id: string, ctx?: UserContext): Promise<Admission> => {
  const manager = requireManager(ctx);
  const existing = await loadManaged(id, manager);

  const from = existing.verification_status;
  if (from !== VERIFICATION_STATUS.DRAFT && from !== VERIFICATION_STATUS.REJECTED) {
    throw new AppError(`Only draft or rejected admissions can be submitted (current: ${from})`, 409);
  }

  const updated = await withTransaction(async (db) => {
    const row = await admissionsModel.setStatus(db, id, VERIFICATION_STATUS.PENDING, manager.id);
    if (!row) throw new AppError('Admission not found', 404);
    await recordChangelog(
      statusChangelog(row, from, VERIFICATION_STATUS.PENDING, manager, from === VERIFICATION_STATUS.REJECTED ? 'Rejected admission resubmitted' : 'Admission submitted for verification'),
      db
    );
    return row;
  });

  void notifyAdminsOfSubmission(updated, from === VERIFICATION_STATUS.REJECTED ? 'resubmitted' : 'submitted');
  return present(updated);
};

export const remove = async (id: string, ctx?: UserContext): Promise<Admission> => {
  const manager = requireManager(ctx);
  await loadManaged(id, manager);

  const deleted = await withTransaction(async (db) => {
    const row = await admissionsModel.softDelete(db, id, manager.id);
    if (!row) throw new AppError('Admission not found', 404);
    await recordChangelog(
      {
        admission_id: id,
        actor_type: actorFor(manager.role),
        changed_by: manager.id,
        action_type: CHANGE_TYPE.UPDATED,
        field_name: 'is_active',
        old_value: true,
        new_value: false,
        diff_summary: 'Admission deactivated',
      },
      db
    );
    return row;
  });

  return present(deleted);
};

export const getChangelogs = async (
  admissionId: string,
  page: number,
  limit: number,
  ctx?: UserContext
): Promise<{ changelogs: any[]; total: number }> => {
  const manager = requireManager(ctx);
  await loadManaged(admissionId, manager);
  return admissionsModel.findChangelogs(admissionId, limit, (page - 1) * limit);
};

// ---------------------------------------------------------------------------
// Activity tracking (best effort)
// ---------------------------------------------------------------------------

async function trackAdmissionView(admissionId: string, ctx: UserContext): Promise<void> {
  try {
    const { create: createActivity } = await import('@domain/user-activity/services/user-activity.service');
    const { ACTIVITY_TYPE } = await import('@config/constants');
    const { ENTITY_TYPES } = await import('@domain/user-activity/constants/user-activity.constants');

    await createActivity({
      user_id: ctx.id,
      user_type: (ctx.role === 'guest' ? USER_TYPE.STUDENT : ctx.role) as any,
      activity_type: ACTIVITY_TYPE.VIEWED,
      entity_type: ENTITY_TYPES.ADMISSION,
      entity_id: admissionId,
      metadata: null,
    });
  } catch (error) {
    log.debug('View tracking failed', (error as Error)?.message);
  }
}
