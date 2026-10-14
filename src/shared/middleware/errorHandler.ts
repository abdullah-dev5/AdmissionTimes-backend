/**
 * Error handling
 *
 * - `AppError` carries an intentional HTTP status.
 * - Framework/client errors (bad JSON, payload too large, upload limits) keep
 *   their 4xx status instead of becoming 500s.
 * - Common Postgres errors map to meaningful 4xx responses.
 * - Admins are alerted about genuine 5xx failures, throttled per error
 *   signature so a single failure mode cannot flood their inboxes.
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('Error');

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public details?: Record<string, string>;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, details?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const PG_ERROR_MAP: Record<string, { status: number; message: string }> = {
  '23505': { status: 409, message: 'A record with these values already exists' },
  '23503': { status: 400, message: 'Referenced record does not exist' },
  '23502': { status: 400, message: 'A required field is missing' },
  '23514': { status: 400, message: 'A value violates a data constraint' },
  '22P02': { status: 400, message: 'Invalid input value' },
  '22007': { status: 400, message: 'Invalid date/time value' },
  '22008': { status: 400, message: 'Date/time value out of range' },
};

const resolveStatus = (err: any): { status: number; message: string; details?: Record<string, string> } => {
  if (err instanceof AppError) {
    return { status: err.statusCode, message: err.message, details: err.details };
  }

  // body-parser / http-errors style (e.g. invalid JSON, payload too large)
  const rawStatus = Number(err?.status ?? err?.statusCode);
  if (rawStatus >= 400 && rawStatus < 500) {
    const message = err?.type === 'entity.parse.failed' ? 'Malformed JSON body' : err?.message || 'Bad request';
    return { status: rawStatus, message };
  }

  // multer upload errors
  if (err?.name === 'MulterError') {
    return { status: err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message: err.message };
  }

  if (typeof err?.code === 'string' && PG_ERROR_MAP[err.code]) {
    return PG_ERROR_MAP[err.code];
  }

  return { status: 500, message: 'Internal server error' };
};

export const errorHandler = (err: Error | AppError, req: Request, res: Response, _next: NextFunction): void => {
  const { status, message, details } = resolveStatus(err);
  const isServerError = status >= 500;

  if (isServerError) {
    log.error(`${req.method} ${req.originalUrl} -> ${status}`, { message: err.message, stack: err.stack });
    void notifyAdminsOfSystemError(err, req);
  } else {
    log.debug(`${req.method} ${req.originalUrl} -> ${status}: ${message}`);
  }

  if (res.headersSent) return;

  const exposeInternals = process.env.NODE_ENV === 'development';
  res.status(status).json({
    success: false,
    message: isServerError && !exposeInternals ? 'Internal server error' : message,
    ...(details ? { errors: details } : {}),
    ...(exposeInternals && isServerError ? { debug: { error: err.message, stack: err.stack } } : {}),
    timestamp: new Date().toISOString(),
  });
};

const ALERT_THROTTLE_MS = 10 * 60 * 1000;
const lastAlertAt = new Map<string, number>();

/**
 * Notify admins of an unexpected server error, at most once per
 * route+message signature per throttle window.
 */
async function notifyAdminsOfSystemError(err: Error, req: Request): Promise<void> {
  const route = `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;
  const signature = `${route}|${err.message}`.slice(0, 300);
  const now = Date.now();
  const previous = lastAlertAt.get(signature);
  if (previous && now - previous < ALERT_THROTTLE_MS) return;
  lastAlertAt.set(signature, now);

  try {
    const { query } = await import('@db/connection');
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');
    const { NOTIFICATION_PRIORITY, NOTIFICATION_TYPE, USER_TYPE } = await import('@config/constants');

    const adminResult = await query(`SELECT id::text AS id FROM users WHERE role = $1 AND status = 'active'`, [USER_TYPE.ADMIN]);
    const recipients = adminResult.rows.map((row: { id: string }) => ({ id: row.id, role: USER_TYPE.ADMIN }));
    if (recipients.length === 0) return;

    const windowBucket = Math.floor(now / ALERT_THROTTLE_MS);
    await publishNotification({
      recipients,
      notification_type: NOTIFICATION_TYPE.SYSTEM_ERROR,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: 'System Error',
      message: `Unhandled error on ${route}: ${err.message}`.slice(0, 500),
      related_entity_type: 'system',
      related_entity_id: null,
      action_url: null,
      event_key: `system_error:${windowBucket}:${signature}`.slice(0, 200),
    });
  } catch (notifyError) {
    log.error('Failed to publish system error notification', (notifyError as Error)?.message);
  }
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
