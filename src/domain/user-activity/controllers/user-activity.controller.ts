/**
 * User Activity Domain - Controller Layer
 * 
 * HTTP request/response handlers for user activity endpoints.
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
import { AppError } from '@shared/middleware/errorHandler';
import * as userActivityService from '../services/user-activity.service';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import {
  UserActivityQueryParams,
  UserContext,
} from '../types/user-activity.types';

/**
 * Get single activity by ID
 * 
 * GET /api/v1/activity/:id
 */
export const getActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContext | undefined;

    const activity = await userActivityService.getById(id, userContext);

    sendSuccess(res, activity, 'Activity retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple activities with filters and pagination
 * 
 * GET /api/v1/activity
 */
export const getActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as UserActivityQueryParams;
    const userContext = req.user as UserContext | undefined;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract filters
    const filters = {
      user_id: queryParams.user_id,
      user_type: queryParams.user_type,
      activity_type: queryParams.activity_type,
      entity_type: queryParams.entity_type,
      entity_id: queryParams.entity_id,
    };

    // Extract sort and order
    const sort = queryParams.sort || 'created_at';
    const order = queryParams.order || 'desc';

    // Get activities
    const { activities, total } = await userActivityService.getMany(
      filters,
      page,
      limit,
      sort,
      order,
      userContext
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, activities, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's activities
 * 
 * GET /api/v1/activity/me
 */
export const getMyActivities = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as UserActivityQueryParams;
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      throw new AppError('Authentication required', 401);
    }

    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    const filters = {
      activity_type: queryParams.activity_type,
      entity_type: queryParams.entity_type,
      entity_id: queryParams.entity_id,
    };

    const sort = queryParams.sort || 'created_at';
    const order = queryParams.order || 'desc';

    const { activities, total } = await userActivityService.getMany(
      filters,
      page,
      limit,
      sort,
      order,
      userContext
    );

    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, activities, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};
