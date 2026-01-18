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
