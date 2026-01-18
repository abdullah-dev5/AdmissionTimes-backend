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
import { sendSuccess } from '@shared/utils/response';
import * as analyticsService from '../services/analytics.service';
import {
  CreateAnalyticsEventDTO,
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
