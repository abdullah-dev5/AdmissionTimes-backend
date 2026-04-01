/**
 * Dashboard Domain - Controller Layer
 * 
 * HTTP request/response handlers for dashboard endpoints.
 * 
 * Responsibilities:
 * - Extract request data (user context from headers)
 * - Call service methods
 * - Format responses using sendSuccess()
 * - Set appropriate HTTP status codes
 * - Handle async errors with try-catch
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '@shared/utils/response';
import * as dashboardService from '../services/dashboard.service';
import * as recommendationsService from '@domain/recommendations/services/recommendations.service';
import { UserContext } from '../types/dashboard.types';

/**
 * Get student dashboard
 * 
 * GET /api/v1/student/dashboard
 */
export const getStudentDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (userContext.role !== 'student') {
      sendError(res, 'Access denied. Student role required.', 403);
      return;
    }

    const dashboardData = await dashboardService.getStudentDashboard(userContext.id);

    sendSuccess(res, dashboardData, 'Dashboard data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get university dashboard
 * 
 * GET /api/v1/university/dashboard
 */
export const getUniversityDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (userContext.role !== 'university') {
      sendError(res, 'Access denied. University role required.', 403);
      return;
    }

    const dashboardData = await dashboardService.getUniversityDashboard(
      userContext.id,
      userContext.university_id
    );

    sendSuccess(res, dashboardData, 'Dashboard data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin dashboard
 * 
 * GET /api/v1/admin/dashboard
 */
export const getAdminDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (userContext.role !== 'admin') {
      sendError(res, 'Access denied. Admin role required.', 403);
      return;
    }

    const dashboardData = await dashboardService.getAdminDashboard(userContext.id);

    sendSuccess(res, dashboardData, 'Dashboard data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get student recommendations
 * 
 * GET /api/v1/student/recommendations
 */
export const getStudentRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (userContext.role !== 'student') {
      sendError(res, 'Access denied. Student role required.', 403);
      return;
    }

    // Get query parameters
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const minScore = parseInt(req.query.min_score as string, 10) || 50;

    const recommendations = await recommendationsService.getRecommendations(
      userContext.id,
      limit,
      minScore
    );

    sendSuccess(res, recommendations, 'Recommendations retrieved successfully');
  } catch (error) {
    next(error);
  }
};
