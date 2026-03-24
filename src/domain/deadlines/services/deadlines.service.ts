/**
 * Deadlines Domain - Service Layer
 * 
 * Business logic and orchestration for deadlines.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Calculate urgency levels
 * - Calculate days remaining
 * - Coordinate between model and other services
 * - Validate business rules
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as deadlinesModel from '../models/deadlines.model';
import {
  Deadline,
  DeadlineWithMetadata,
  CreateDeadlineDTO,
  UpdateDeadlineDTO,
  DeadlineFilters,
} from '../types/deadlines.types';
import { URGENCY_THRESHOLDS } from '../constants/deadlines.constants';
import * as admissionsModel from '@domain/admissions/models/admissions.model';
import { NOTIFICATION_PRIORITY, NOTIFICATION_TYPE, USER_TYPE } from '@config/constants';
import { enqueueNotificationJob } from '@domain/notifications/services/notificationJobQueue';
import * as notificationsModel from '@domain/notifications/models/notifications.model';

const RETRY_BACKOFF_MS = [1000, 2000, 4000];

/**
 * Calculate days remaining until deadline
 * 
 * @param deadlineDate - Deadline date (ISO8601)
 * @returns Days remaining (negative if overdue)
 */
function calculateDaysRemaining(deadlineDate: string): number {
  const deadline = new Date(deadlineDate);
  const now = new Date();
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Determine urgency level based on days remaining
 * 
 * @param daysRemaining - Days remaining until deadline
 * @returns Urgency level
 */
function determineUrgencyLevel(daysRemaining: number): 'low' | 'medium' | 'high' | 'critical' | 'expired' {
  if (daysRemaining < URGENCY_THRESHOLDS.EXPIRED) {
    return 'expired';
  }
  if (daysRemaining <= URGENCY_THRESHOLDS.CRITICAL) {
    return 'critical';
  }
  if (daysRemaining <= URGENCY_THRESHOLDS.HIGH) {
    return 'high';
  }
  if (daysRemaining <= URGENCY_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  return 'low';
}

/**
 * Enrich deadline with calculated metadata
 * 
 * @param deadline - Deadline record
 * @returns Deadline with metadata
 */
function enrichDeadline(deadline: Deadline): DeadlineWithMetadata {
  const daysRemaining = calculateDaysRemaining(deadline.deadline_date);
  const isOverdue = daysRemaining < 0;
  const urgencyLevel = determineUrgencyLevel(daysRemaining);

  return {
    ...deadline,
    days_remaining: daysRemaining,
    is_overdue: isOverdue,
    urgency_level: urgencyLevel,
  };
}

/**
 * Get deadline by ID
 * 
 * @param id - Deadline UUID
 * @returns Deadline record with metadata
 * @throws AppError if not found
 */
export const getById = async (id: string): Promise<DeadlineWithMetadata> => {
  const deadline = await deadlinesModel.findById(id);

  if (!deadline) {
    throw new AppError('Deadline not found', 404);
  }

  return enrichDeadline(deadline);
};

/**
 * Get multiple deadlines with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @returns Object with deadlines array and total count
 */
export const getMany = async (
  filters: DeadlineFilters,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc'
): Promise<{ deadlines: DeadlineWithMetadata[]; total: number }> => {
  // Get deadlines and total count
  const [deadlines, total] = await Promise.all([
    deadlinesModel.findMany(filters, page, limit, sort, order),
    deadlinesModel.count(filters),
  ]);

  // Enrich all deadlines with metadata
  const enrichedDeadlines = deadlines.map(enrichDeadline);

  return { deadlines: enrichedDeadlines, total };
};

/**
 * Get deadlines for a specific admission
 * 
 * @param admissionId - Admission UUID
 * @returns Array of deadlines with metadata
 */
export const getByAdmissionId = async (admissionId: string): Promise<DeadlineWithMetadata[]> => {
  // Verify admission exists
  const admission = await admissionsModel.findById(admissionId);
  if (!admission) {
    throw new AppError('Admission not found', 404);
  }

  const deadlines = await deadlinesModel.findByAdmissionId(admissionId);
  return deadlines.map(enrichDeadline);
};

/**
 * Get upcoming deadlines
 * 
 * @param limit - Maximum number of deadlines to return
 * @returns Array of upcoming deadlines with metadata
 */
export const getUpcoming = async (limit: number = 10): Promise<DeadlineWithMetadata[]> => {
  const deadlines = await deadlinesModel.findUpcoming(limit);
  return deadlines.map(enrichDeadline);
};

/**
 * Create a new deadline
 * 
 * @param data - Deadline data
 * @returns Created deadline record with metadata
 * @throws AppError if admission not found or validation fails
 */
export const create = async (data: CreateDeadlineDTO): Promise<DeadlineWithMetadata> => {
  // Verify admission exists
  const admission = await admissionsModel.findById(data.admission_id);
  if (!admission) {
    throw new AppError('Admission not found', 404);
  }

  // Validate deadline date is in the future (for new deadlines)
  const deadlineDate = new Date(data.deadline_date);
  const now = new Date();
  if (deadlineDate <= now) {
    throw new AppError('Deadline date must be in the future', 400);
  }

  const deadline = await deadlinesModel.create(data);
  return enrichDeadline(deadline);
};

/**
 * Update an existing deadline
 * 
 * @param id - Deadline UUID
 * @param data - Partial deadline data to update
 * @returns Updated deadline record with metadata
 * @throws AppError if not found
 */
export const update = async (
  id: string,
  data: UpdateDeadlineDTO
): Promise<DeadlineWithMetadata> => {
  const deadline = await deadlinesModel.findById(id);

  if (!deadline) {
    throw new AppError('Deadline not found', 404);
  }

  // If updating deadline_date, validate it's in the future
  if (data.deadline_date) {
    const deadlineDate = new Date(data.deadline_date);
    const now = new Date();
    if (deadlineDate <= now) {
      throw new AppError('Deadline date must be in the future', 400);
    }
  }

  const deadlineDateChanged =
    data.deadline_date !== undefined &&
    new Date(data.deadline_date).getTime() !== new Date(deadline.deadline_date).getTime();

  const updatePayload: UpdateDeadlineDTO = deadlineDateChanged
    ? {
        ...data,
        reminder_sent: false,
        reminder_sent_7d_at: null,
        reminder_sent_3d_at: null,
        reminder_sent_1d_at: null,
      }
    : data;

  const updated = await deadlinesModel.update(id, updatePayload);

  if (!updated) {
    throw new AppError('Deadline not found', 404);
  }

  if (deadlineDateChanged) {
    const deleted = await notificationsModel.deleteDeadlineReminderNotificationsByDeadlineId(id);
    console.log(
      `[DeadlinesService] Deadline date changed for ${id}; reset reminder flags and cleared ${deleted} stale deadline reminder notifications`
    );
  }

  return enrichDeadline(updated);
};

/**
 * Delete a deadline
 * 
 * @param id - Deadline UUID
 * @returns True if deleted
 * @throws AppError if not found
 */
export const deleteById = async (id: string): Promise<boolean> => {
  const deadline = await deadlinesModel.findById(id);

  if (!deadline) {
    throw new AppError('Deadline not found', 404);
  }

  return await deadlinesModel.deleteById(id);
};

/**
 * Get user's upcoming deadlines with admission and university details
 * 
 * @param userId - User UUID
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @param lookAheadDays - Number of days in future to look for
 * @param alertOptInOnly - Only include deadlines with alerts enabled
 * @returns Object with deadlines array and total count
 */
export const getUserUpcomingDeadlines = async (
  userId: string,
  page: number,
  limit: number,
  lookAheadDays: number = 7,
  alertOptInOnly: boolean = true
): Promise<{ deadlines: DeadlineWithMetadata[]; total: number }> => {
  // Get deadlines and total count
  const [deadlines, total] = await Promise.all([
    deadlinesModel.findUserUpcomingDeadlines(userId, page, limit, lookAheadDays, alertOptInOnly),
    deadlinesModel.countUserUpcomingDeadlines(userId, lookAheadDays, alertOptInOnly),
  ]);

  // Enrich all deadlines with metadata
  const enrichedDeadlines = deadlines.map(enrichDeadline);

  return { deadlines: enrichedDeadlines, total };
};

/**
 * Trigger deadline reminder notifications for watchlisted admissions
 *
 * @param lookAheadDays - Number of days ahead to include
 * @returns Count summary
 */
export const triggerDeadlineReminders = async (
  lookAheadDays: number = 3
): Promise<{ targets: number; sent: number }> => {
  const thresholds = [7, 3, 1].filter((day) => day <= Math.max(1, Math.floor(lookAheadDays)));
  const result = await triggerDeadlineReminderNotifications(thresholds.length ? thresholds : [1]);
  return { targets: result.targets, sent: result.succeeded };
};

/**
 * Trigger deadline reminder notifications for watchlist users.
 *
 * Uses idempotent event keys scoped per day:
 * deadline_near:<deadline_id>:<recipient_id>:<yyyy-mm-dd>
 */
export const triggerDeadlineReminderNotifications = async (
  thresholdDays: number[] = [7, 3, 1],
  options?: { forceRun?: boolean }
): Promise<{ targets: number; attempted: number; succeeded: number; failed: number; deduped: number }> => {
  const forceRun = options?.forceRun === true;
  const normalizedThresholds = Array.from(
    new Set(thresholdDays.map((d) => Math.max(1, Math.floor(d))).filter((d) => Number.isFinite(d)))
  ).sort((a, b) => b - a);
  const maxLookAhead = normalizedThresholds.length > 0 ? normalizedThresholds[0] : 7;

  const targets = await deadlinesModel.findReminderTargets(maxLookAhead);
  const forceRunKey = forceRun
    ? `manual-${new Date().toISOString().replace(/[:.]/g, '-')}`
    : null;

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let deduped = 0;
  const sentByThreshold: Record<number, Set<string>> = {
    7: new Set<string>(),
    3: new Set<string>(),
    1: new Set<string>(),
  };

  for (const target of targets) {
    const daysRemainingRaw = Number(target.days_remaining_precise);
    const daysRemaining = Number.isFinite(daysRemainingRaw)
      ? daysRemainingRaw
      : calculateDaysRemaining(target.deadline_date);

    // Threshold windows prevent misses from hourly scheduling jitter.
    // Example: threshold 7 matches when daysRemaining is in (6, 7].
    const matchedThreshold = normalizedThresholds.find(
      (threshold) => daysRemaining > threshold - 1 && daysRemaining <= threshold
    );

    if (!matchedThreshold) {
      continue;
    }

    const priority = matchedThreshold <= 2 ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.MEDIUM;

    attempted += 1;

    try {
      const eventKey = forceRunKey
        ? `deadline_near:${target.deadline_id}:${target.recipient_id}:d${matchedThreshold}:${forceRunKey}`
        : `deadline_near:${target.deadline_id}:${target.recipient_id}:d${matchedThreshold}`;

      const result = await publishWithRetry({
        recipients: [{ id: target.recipient_id, role: USER_TYPE.STUDENT }],
        notification_type: NOTIFICATION_TYPE.DEADLINE_NEAR,
        priority,
        title: `Deadline Approaching: ${target.admission_title}`,
        message: `Your saved program has an upcoming ${target.deadline_type} deadline in ${matchedThreshold} day(s).`,
        related_entity_type: 'deadline',
        related_entity_id: target.deadline_id,
        action_url: `/admissions/${target.admission_id}`,
        event_key: eventKey,
      });

      const publishedNotifications = Array.isArray(result) ? result : [];
      const createdCount = publishedNotifications.filter(
        (notification: any) => notification && notification.__existing !== true
      ).length;
      const dedupedCount = publishedNotifications.filter(
        (notification: any) => notification && notification.__existing === true
      ).length;

      deduped += dedupedCount;

      if (createdCount > 0) {
        succeeded += createdCount;
        await deadlinesModel.createReminderDeliveryLog({
          deadline_id: target.deadline_id,
          recipient_id: target.recipient_id,
          threshold_day: matchedThreshold,
          status: 'sent',
          notification_id: publishedNotifications[0]?.id || null,
          event_key: eventKey,
        });
      }

      if (dedupedCount > 0) {
        await deadlinesModel.createReminderDeliveryLog({
          deadline_id: target.deadline_id,
          recipient_id: target.recipient_id,
          threshold_day: matchedThreshold,
          status: 'deduped',
          notification_id: publishedNotifications[0]?.id || null,
          event_key: eventKey,
        });
      }

      if ((createdCount > 0 || dedupedCount > 0) && sentByThreshold[matchedThreshold]) {
        sentByThreshold[matchedThreshold].add(target.deadline_id);
      }
    } catch (error) {
      failed += 1;
      const eventKey = forceRunKey
        ? `deadline_near:${target.deadline_id}:${target.recipient_id}:d${matchedThreshold}:${forceRunKey}`
        : `deadline_near:${target.deadline_id}:${target.recipient_id}:d${matchedThreshold}`;

      console.error('❌ [DEADLINE-REMINDER] Failed to publish deadline reminder:', {
        deadline_id: target.deadline_id,
        recipient_id: target.recipient_id,
        error: error instanceof Error ? error.message : String(error),
      });

      await deadlinesModel.createReminderDeliveryLog({
        deadline_id: target.deadline_id,
        recipient_id: target.recipient_id,
        threshold_day: matchedThreshold,
        status: 'failed',
        notification_id: null,
        event_key: eventKey,
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Persist per-threshold reminder send markers for operational tracking.
  for (const threshold of [7, 3, 1]) {
    const sentDeadlineIds = Array.from(sentByThreshold[threshold]);
    if (sentDeadlineIds.length > 0) {
      await deadlinesModel.markReminderThresholdSent(sentDeadlineIds, threshold);
    }
  }

  return {
    targets: targets.length,
    attempted,
    succeeded,
    failed,
    deduped,
  };
};

/**
 * Fetch recent reminder delivery logs for monitoring.
 */
export const getReminderDeliveryLogs = async (
  filters?: { status?: 'sent' | 'failed' | 'deduped'; limit?: number }
): Promise<any[]> => {
  return deadlinesModel.getReminderDeliveryLogs(filters || {});
};

async function publishWithRetry(input: any): Promise<any> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      return await enqueueNotificationJob(input);
    } catch (error) {
      lastError = error;

      if (attempt === RETRY_BACKOFF_MS.length) {
        break;
      }

      const delayMs = RETRY_BACKOFF_MS[attempt];
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to publish notification after retries');
}
