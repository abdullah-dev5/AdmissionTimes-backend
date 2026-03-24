/**
 * Scheduler Controller
 * 
 * HTTP handlers for scheduler health and management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { getSchedulerMetrics } from '@shared/scheduler';
import * as deadlinesService from '@domain/deadlines/services/deadlines.service';

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

/**
 * GET /api/v1/scheduler/reminder-logs
 *
 * Returns recent reminder delivery outcomes.
 * Supports optional filters: status (sent|failed|deduped), limit (1-200)
 */
export const getReminderLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = statusParam === 'sent' || statusParam === 'failed' || statusParam === 'deduped'
      ? statusParam
      : undefined;

    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
    const limit = Number.isFinite(limitParam) ? limitParam : 50;

    const logs = await deadlinesService.getReminderDeliveryLogs({ status, limit });

    res.status(200).json({
      success: true,
      data: logs,
      meta: {
        status: status || null,
        limit: Math.min(200, Math.max(1, limit)),
        count: logs.length,
      },
    });
  } catch (error) {
    next(error);
  }
};
