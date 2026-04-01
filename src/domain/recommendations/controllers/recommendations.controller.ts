/**
 * Recommendations Domain - Controller Layer
 * 
 * HTTP request/response handlers for recommendations endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@shared/utils/response';
import * as recommendationsService from '../services/recommendations.service';
import { AppError } from '@shared/middleware/errorHandler';

/**
 * User context interface
 */
interface UserContext {
  id: string | null;
  role: 'student' | 'university' | 'admin' | 'guest';
  university_id?: string | null;
}

/**
 * Get recommendations for authenticated user
 * 
 * GET /api/v1/recommendations
 */
export const getMyRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      throw new AppError('Authentication required', 401);
    }

    if (userContext.role !== 'student') {
      throw new AppError('Access denied. Student role required.', 403);
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const minScore = parseInt(req.query.min_score as string) || 50;

    const recommendations = await recommendationsService.getRecommendations(
      userContext.id,
      limit,
      minScore
    );

    sendSuccess(res, {
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh recommendations for authenticated user
 * 
 * POST /api/v1/recommendations/refresh
 */
export const refreshMyRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      throw new AppError('Authentication required', 401);
    }

    if (userContext.role !== 'student') {
      throw new AppError('Access denied. Student role required.', 403);
    }

    const count = await recommendationsService.refreshUserRecommendations(userContext.id);

    sendSuccess(res, {
      message: 'Recommendations refreshed successfully',
      count
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate recommendations for all users (Admin only)
 * 
 * POST /api/v1/recommendations/generate-all
 */
export const generateAllRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || userContext.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const batchSize = Math.min(parseInt(req.body.batch_size) || 50, 100);

    const result = await recommendationsService.generateRecommendationsForAllUsers(batchSize);

    sendSuccess(res, {
      message: 'Batch generation completed',
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clean up expired recommendations (Admin only)
 * 
 * DELETE /api/v1/recommendations/cleanup
 */
export const cleanupRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || userContext.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const count = await recommendationsService.cleanupExpiredRecommendations();

    sendSuccess(res, {
      message: 'Cleanup completed',
      deletedCount: count
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recommendation count for authenticated user
 * 
 * GET /api/v1/recommendations/count
 */
export const getRecommendationCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || !userContext.id) {
      throw new AppError('Authentication required', 401);
    }

    if (userContext.role !== 'student') {
      throw new AppError('Access denied. Student role required.', 403);
    }

    const count = await recommendationsService.getRecommendationCount(userContext.id);

    sendSuccess(res, { count });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recommendations observability metrics (Admin only)
 *
 * GET /api/v1/recommendations/observability
 */
export const getRecommendationsObservability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    if (!userContext || userContext.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }

    const metrics = recommendationsService.getRecommendationObservability();

    sendSuccess(res, metrics);
  } catch (error) {
    next(error);
  }
};
