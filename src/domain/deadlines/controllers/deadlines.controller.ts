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
