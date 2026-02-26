/**
 * Scheduler Controller
 * 
 * HTTP handlers for scheduler health and management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { getSchedulerMetrics } from '@shared/scheduler';

/**
 * GET /api/v1/scheduler/health
 * 
 * Returns scheduler health metrics including last run times,
 * success counts, and error details for all scheduled jobs.
 * 
 * Admin-only endpoint for monitoring scheduler health.
 */
export const getSchedulerHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const metrics = getSchedulerMetrics();

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};
