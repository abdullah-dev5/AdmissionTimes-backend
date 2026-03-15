/**
 * Deadlines Domain - Controller Layer
 * 
 * HTTP request/response handlers for deadlines endpoints.
 * 
 * Responsibilities:
 * - Extract request data (body, params, query)
 * - Call service methods
 * - Format responses using sendSuccess(), sendError(), sendPaginated()
 * - Set appropriate HTTP status codes
 * - Handle async errors with try-catch
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import * as deadlinesService from '../services/deadlines.service';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import {
  DeadlineQueryParams,
} from '../types/deadlines.types';

/**
 * Get single deadline by ID
 * 
 * GET /api/v1/deadlines/:id
 */
export const getDeadline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const deadline = await deadlinesService.getById(id);

    sendSuccess(res, deadline, 'Deadline retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple deadlines with filters and pagination
 * 
 * GET /api/v1/deadlines
 */
export const getDeadlines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as DeadlineQueryParams;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract filters
    const filters = {
      admission_id: queryParams.admission_id,
      deadline_type: queryParams.deadline_type,
      is_overdue: queryParams.is_overdue,
      is_upcoming: queryParams.is_upcoming,
      date_from: queryParams.date_from,
      date_to: queryParams.date_to,
    };

    // Extract sort and order
    const sort = queryParams.sort || 'deadline_date';
    const order = queryParams.order || 'asc';

    // Get deadlines
    const { deadlines, total } = await deadlinesService.getMany(
      filters,
      page,
      limit,
      sort,
      order
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, deadlines, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Get deadlines for a specific admission
 * 
 * GET /api/v1/admissions/:admissionId/deadlines
 */
export const getAdmissionDeadlines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { admissionId } = req.params;

    const deadlines = await deadlinesService.getByAdmissionId(admissionId);

    sendSuccess(res, deadlines, 'Deadlines retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get upcoming deadlines
 * 
 * GET /api/v1/deadlines/upcoming
 */
export const getUpcomingDeadlines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;

    const deadlines = await deadlinesService.getUpcoming(limit);

    sendSuccess(res, deadlines, 'Upcoming deadlines retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get urgent deadlines (within 3 days)
 * 
 * GET /api/v1/deadlines/urgent
 */
export const getUrgentDeadlines = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Urgent deadlines are limited to 3 days
    const deadlines = await deadlinesService.getUpcoming(3);

    sendSuccess(res, deadlines, 'Urgent deadlines retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new deadline
 * 
 * POST /api/v1/deadlines
 */
export const createDeadline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as any;

    const deadline = await deadlinesService.create(data);

    sendSuccess(res, deadline, 'Deadline created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a deadline
 * 
 * PUT /api/v1/deadlines/:id
 */
export const updateDeadline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as any;

    const deadline = await deadlinesService.update(id, data);

    sendSuccess(res, deadline, 'Deadline updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a deadline
 * 
 * DELETE /api/v1/deadlines/:id
 */
export const deleteDeadline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    await deadlinesService.deleteById(id);

    sendSuccess(res, null, 'Deadline deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger deadline reminder notifications (scheduler endpoint)
 *
 * POST /api/v1/scheduler/reminder
 */
export const triggerDeadlineReminders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.role && req.user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const bodyThresholds = Array.isArray(req.body?.threshold_days)
      ? req.body.threshold_days
      : [];

    const parsedThresholds = bodyThresholds
      .map((day: unknown) => Number(day))
      .filter((day: number) => Number.isFinite(day) && day > 0)
      .map((day: number) => Math.floor(day));

    const thresholds = parsedThresholds.length > 0 ? parsedThresholds : [7, 3, 1];
    const forceRun = req.body?.force_run === true;

    const result = await deadlinesService.triggerDeadlineReminderNotifications(thresholds, { forceRun });

    sendSuccess(res, result, 'Deadline reminders triggered successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's upcoming deadlines with admission and university details
 * 
 * GET /api/v1/users/me/upcoming-deadlines
 */
export const getUserUpcomingDeadlines = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id; // From JWT middleware
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const {
      days = 7,
      limit = 20,
      page = 1,
      alert_enabled = true
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const lookAheadDays = Math.max(1, parseInt(days as string) || 7);
    const alertOptIn = alert_enabled === 'true' || alert_enabled === true;

    // Get deadlines
    const { deadlines, total } = await deadlinesService.getUserUpcomingDeadlines(
      userId,
      pageNum,
      pageSize,
      lookAheadDays,
      alertOptIn
    );

    // Calculate pagination metadata
    const pagination = {
      page: pageNum,
      limit: pageSize,
      total,
      pages: Math.ceil(total / pageSize)
    };

    res.status(200).json({
      success: true,
      data: deadlines,
      pagination
    });
  } catch (error) {
    next(error);
  }
};

