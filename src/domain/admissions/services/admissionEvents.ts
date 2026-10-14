/**
 * Admission domain events: changelog entries and notifications.
 *
 * Shared by the university/admin admission service and the admin moderation
 * service so both paths record identical history and notify consistently.
 *
 * Notification event keys are deterministic (derived from the admission state
 * that triggered them), so retries and duplicate calls are deduplicated by
 * the notifications unique key instead of producing repeated alerts.
 */

import { query } from '@db/connection';
import { NOTIFICATION_PRIORITY, NOTIFICATION_TYPE, USER_TYPE, type UserType } from '@config/constants';
import { publishNotification } from '@domain/notifications/services/notificationPublisher';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('AdmissionEvents');

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> };

export type ChangelogActor = 'admin' | 'university' | 'system';

export interface ChangelogEntry {
  admission_id: string;
  actor_type: ChangelogActor;
  changed_by: string | null;
  action_type: 'created' | 'updated' | 'verified' | 'rejected' | 'status_changed';
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  diff_summary: string;
  metadata?: Record<string, unknown> | null;
}

interface AdmissionRef {
  id: string;
  title: string;
  university_id?: string | null;
  created_by?: string | null;
  updated_at?: string | Date | null;
  verified_at?: string | Date | null;
}

const toJson = (value: unknown): string | null => (value === undefined || value === null ? null : JSON.stringify(value));

const stamp = (value: string | Date | null | undefined): string =>
  value ? new Date(value).toISOString() : new Date().toISOString();

export const actorFor = (role: string | undefined): ChangelogActor => (role === 'admin' ? 'admin' : 'university');

/**
 * Insert changelog entries. Pass a transaction client to make history atomic
 * with the change it describes.
 */
export const recordChangelog = async (entries: ChangelogEntry | ChangelogEntry[], db: Queryable = { query }): Promise<void> => {
  const list = Array.isArray(entries) ? entries : [entries];
  for (const entry of list) {
    await db.query(
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
        toJson(entry.old_value),
        toJson(entry.new_value),
        entry.diff_summary,
        toJson(entry.metadata ?? null),
      ]
    );
  }
};

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

export const getAdminRecipients = async (): Promise<Array<{ id: string; role: UserType }>> => {
  const result = await query(`SELECT id::text AS id FROM users WHERE role = 'admin' AND status = 'active'`);
  return result.rows.map((row) => ({ id: row.id as string, role: USER_TYPE.ADMIN }));
};

/** All active representatives of the admission's university (or its creator as fallback). */
export const getUniversityRecipients = async (admission: AdmissionRef): Promise<Array<{ id: string; role: UserType }>> => {
  if (admission.university_id) {
    const result = await query(
      `SELECT id::text AS id FROM users WHERE role = 'university' AND status = 'active' AND university_id = $1`,
      [admission.university_id]
    );
    if (result.rows.length) {
      return result.rows.map((row) => ({ id: row.id as string, role: USER_TYPE.UNIVERSITY }));
    }
  }
  return admission.created_by ? [{ id: admission.created_by, role: USER_TYPE.UNIVERSITY }] : [];
};

export const getWatcherIds = async (admissionId: string): Promise<string[]> => {
  const result = await query(
    `SELECT DISTINCT w.user_id::text AS user_id
     FROM watchlists w
     JOIN users u ON u.id = w.user_id AND u.status = 'active'
     WHERE w.admission_id = $1`,
    [admissionId]
  );
  return result.rows.map((row) => row.user_id as string);
};

const safely = async (label: string, work: () => Promise<unknown>): Promise<void> => {
  try {
    await work();
  } catch (error) {
    log.error(`${label} failed`, (error as Error)?.message);
  }
};

// ---------------------------------------------------------------------------
// Notifications (never throw: a failed notification must not fail the request)
// ---------------------------------------------------------------------------

export type SubmissionKind = 'submitted' | 'resubmitted' | 'updated_pending' | 'reverification';

const SUBMISSION_COPY: Record<SubmissionKind, { title: (t: string) => string; message: (t: string) => string; priority: string }> = {
  submitted: {
    title: () => 'New Admission Submitted',
    message: (t) => `"${t}" has been submitted for verification.`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
  },
  resubmitted: {
    title: (t) => `${t} Resubmitted`,
    message: (t) => `A previously rejected admission "${t}" was revised and resubmitted.`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
  },
  updated_pending: {
    title: (t) => `${t} Updated`,
    message: (t) => `A pending admission "${t}" was edited. Review the latest changes.`,
    priority: NOTIFICATION_PRIORITY.LOW,
  },
  reverification: {
    title: (t) => `${t} Needs Re-verification`,
    message: (t) => `The verified admission "${t}" was edited by its university and is hidden until re-verified.`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  },
};

export const notifyAdminsOfSubmission = (admission: AdmissionRef, kind: SubmissionKind): Promise<void> =>
  safely(`notifyAdmins(${kind})`, async () => {
    const recipients = await getAdminRecipients();
    const copy = SUBMISSION_COPY[kind];
    await publishNotification({
      recipients,
      notification_type: kind === 'submitted' ? NOTIFICATION_TYPE.ADMISSION_SUBMITTED : kind === 'resubmitted' ? NOTIFICATION_TYPE.ADMISSION_RESUBMITTED : NOTIFICATION_TYPE.ADMISSION_UPDATED_SAVED,
      priority: copy.priority as any,
      title: copy.title(admission.title),
      message: copy.message(admission.title),
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/admin/verification?admission=${admission.id}`,
      event_key: `admission_${kind}:${admission.id}:${stamp(admission.updated_at)}`,
    });
  });

export type ModerationDecision = 'verified' | 'rejected' | 'revision_required';

export const notifyUniversityOfDecision = (admission: AdmissionRef, decision: ModerationDecision, reason?: string | null): Promise<void> =>
  safely(`notifyUniversity(${decision})`, async () => {
    const recipients = await getUniversityRecipients(admission);
    const copy = {
      verified: {
        type: NOTIFICATION_TYPE.ADMISSION_VERIFIED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: 'Admission Verified',
        message: `Your admission "${admission.title}" has been verified and is now visible to students.`,
      },
      rejected: {
        type: NOTIFICATION_TYPE.ADMISSION_REJECTED,
        priority: NOTIFICATION_PRIORITY.HIGH,
        title: 'Admission Rejected',
        message: `Your admission "${admission.title}" was rejected. Reason: ${reason || 'No reason provided'}`,
      },
      revision_required: {
        type: NOTIFICATION_TYPE.ADMISSION_REVISION_REQUIRED,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        title: 'Revision Requested',
        message: `An administrator requested changes to "${admission.title}". Notes: ${reason || '—'}`,
      },
    }[decision];

    await publishNotification({
      recipients,
      notification_type: copy.type,
      priority: copy.priority,
      title: copy.title,
      message: copy.message,
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/university/manage-admissions?edit=${admission.id}`,
      event_key: `admission_${decision}:${admission.id}:${stamp(admission.updated_at)}`,
    });
  });

/** Tell students who saved the admission that its (verified) details changed. */
export const notifyWatchersOfUpdate = (admission: AdmissionRef): Promise<void> =>
  safely('notifyWatchers', async () => {
    const watcherIds = await getWatcherIds(admission.id);
    if (!watcherIds.length) return;

    await publishNotification({
      recipients: watcherIds.map((id) => ({ id, role: USER_TYPE.STUDENT })),
      notification_type: NOTIFICATION_TYPE.ADMISSION_UPDATED_SAVED,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
      title: `${admission.title} Updated`,
      message: 'A program you saved has new or changed details. Check the latest information.',
      related_entity_type: 'admission',
      related_entity_id: admission.id,
      action_url: `/program/${admission.id}`,
      event_key: `admission_watch_update:${admission.id}:${stamp(admission.updated_at)}`,
    });
  });
