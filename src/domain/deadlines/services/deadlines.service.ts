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
import { query } from '@db/connection';
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

  const updated = await deadlinesModel.update(id, data);

  if (!updated) {
    throw new AppError('Deadline not found', 404);
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
  const sql = `
    SELECT
      d.id::text as deadline_id,
      d.deadline_type,
      d.deadline_date::text as deadline_date,
      d.admission_id::text as admission_id,
      a.title as admission_title,
      wl.user_id::text as recipient_id
    FROM deadlines d
    INNER JOIN admissions a ON a.id = d.admission_id
    INNER JOIN watchlists wl ON wl.admission_id = d.admission_id
    WHERE d.deadline_date > NOW()
      AND d.deadline_date <= NOW() + ($1 || ' days')::interval
      AND a.verification_status = 'verified'
      AND a.is_active = true
      AND wl.alert_opt_in = true
  `;

  const result = await query(sql, [lookAheadDays]);
  const targets = result.rows as Array<{
    deadline_id: string;
    deadline_date: string;
    deadline_type: string;
    admission_id: string;
    admission_title: string;
    recipient_id: string;
  }>;

  let sent = 0;
  const reminderDeadlineIds = new Set<string>();

  for (const target of targets) {
    const daysRemaining = calculateDaysRemaining(target.deadline_date);
    const priority = daysRemaining <= 3 ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.MEDIUM;
    const eventKey = `deadline_near:${target.deadline_id}:${target.recipient_id}:${target.deadline_date}`;

    await enqueueNotificationJob({
      recipients: [{ id: target.recipient_id, role: USER_TYPE.STUDENT }],
      notification_type: NOTIFICATION_TYPE.DEADLINE_NEAR,
      priority,
      title: 'Deadline Approaching',
      message: `"${target.admission_title}" deadline is in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
      related_entity_type: 'admission',
      related_entity_id: target.admission_id,
      action_url: `/admissions/${target.admission_id}`,
      event_key: eventKey,
    });

    reminderDeadlineIds.add(target.deadline_id);
    sent += 1;
  }

  if (reminderDeadlineIds.size > 0) {
    await query(
      `UPDATE deadlines SET reminder_sent = true, updated_at = NOW() WHERE id = ANY($1::uuid[])`,
      [Array.from(reminderDeadlineIds)]
    );
  }

  return { targets: targets.length, sent };
};

/**
 * Trigger deadline reminder notifications for watchlist users.
 *
 * Uses idempotent event keys scoped per day:
 * deadline_near:<deadline_id>:<recipient_id>:<yyyy-mm-dd>
 */
export const triggerDeadlineReminderNotifications = async (
  thresholdDays: number[] = [7, 3, 1]
): Promise<{ targets: number; attempted: number; succeeded: number; failed: number }> => {
  const normalizedThresholds = Array.from(
    new Set(thresholdDays.map((d) => Math.max(1, Math.floor(d))).filter((d) => Number.isFinite(d)))
  ).sort((a, b) => b - a);
  const maxLookAhead = normalizedThresholds.length > 0 ? normalizedThresholds[0] : 7;

  const targets = await deadlinesModel.findReminderTargets(maxLookAhead);
  const runKey = new Date().toISOString().slice(0, 10);

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  for (const target of targets) {
    const daysRemaining = calculateDaysRemaining(target.deadline_date);
    if (!normalizedThresholds.includes(daysRemaining)) {
      continue;
    }

    const priority = daysRemaining <= 2 ? NOTIFICATION_PRIORITY.HIGH : NOTIFICATION_PRIORITY.MEDIUM;

    attempted += 1;

    try {
      const eventKey = `deadline_near:${target.deadline_id}:${target.recipient_id}:d${daysRemaining}:${runKey}`;

      await enqueueNotificationJob({
        recipients: [{ id: target.recipient_id, role: USER_TYPE.STUDENT }],
        notification_type: NOTIFICATION_TYPE.DEADLINE_NEAR,
        priority,
        title: `Deadline Approaching: ${target.admission_title}`,
        message: `Your saved program has an upcoming ${target.deadline_type} deadline in ${daysRemaining} day(s).`,
        related_entity_type: 'deadline',
        related_entity_id: target.deadline_id,
        action_url: `/admissions/${target.admission_id}`,
        event_key: eventKey,
      });

      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error('❌ [DEADLINE-REMINDER] Failed to publish deadline reminder:', {
        deadline_id: target.deadline_id,
        recipient_id: target.recipient_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    targets: targets.length,
    attempted,
    succeeded,
    failed,
  };
};
