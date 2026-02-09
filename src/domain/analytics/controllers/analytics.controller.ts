/**
 * Analytics Domain - Controller Layer
 * 
 * HTTP request/response handlers for analytics endpoints.
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
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import * as analyticsService from '../services/analytics.service';
import {
  CreateAnalyticsEventDTO,
  AnalyticsQueryParams,
} from '../types/analytics.types';

/**
 * Track an analytics event
 * 
 * POST /api/v1/analytics/events
 */
export const trackEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as CreateAnalyticsEventDTO;

    const event = await analyticsService.trackEvent(data);

    sendSuccess(res, event, 'Event tracked successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get general statistics
 * 
 * GET /api/v1/analytics/stats
 */
export const getGeneralStatistics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await analyticsService.getGeneralStatistics();

    sendSuccess(res, stats, 'Statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get admission statistics
 * 
 * GET /api/v1/analytics/admissions
 */
export const getAdmissionStatistics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await analyticsService.getAdmissionStatistics();

    sendSuccess(res, stats, 'Admission statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user statistics
 * 
 * GET /api/v1/analytics/users
 */
export const getUserStatistics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await analyticsService.getUserStatistics();

    sendSuccess(res, stats, 'User statistics retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get aggregated activity feed
 * 
 * GET /api/v1/analytics/activity
 */
export const getActivityFeed = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const feed = await analyticsService.getActivityFeed(limit);

    sendSuccess(res, feed, 'Activity feed retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get analytics events with filters and pagination
 *
 * GET /api/v1/analytics/user-activity
 */
export const getEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as AnalyticsQueryParams;

    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    const filters = {
      event_type: queryParams.event_type,
      entity_type: queryParams.entity_type,
      entity_id: queryParams.entity_id,
      user_type: queryParams.user_type,
      user_id: queryParams.user_id,
      date_from: queryParams.date_from,
      date_to: queryParams.date_to,
    };

    const sort = queryParams.sort || 'created_at';
    const order = queryParams.order || 'desc';

    const { events, total } = await analyticsService.getEvents(
      filters,
      page,
      limit,
      sort,
      order
    );

    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, events, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};
