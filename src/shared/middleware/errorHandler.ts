/**
 * Error handling middleware
 * 
 * Centralized error handling for the application.
 * Handles different types of errors and returns appropriate responses.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 * 
 * @param err - Error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Notify admins on unexpected errors (non-AppError)
  if (!(err instanceof AppError)) {
    void notifyAdminsOfSystemError(err, req);
  }

  // Handle AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
    return;
  }

  // Handle unexpected errors
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

async function notifyAdminsOfSystemError(err: Error, req: Request): Promise<void> {
  try {
    const { query } = await import('@db/connection');
    const { publishNotification } = await import('@domain/notifications/services/notificationPublisher');
    const { NOTIFICATION_PRIORITY, NOTIFICATION_TYPE, USER_TYPE } = await import('@config/constants');

    const adminResult = await query('SELECT id::text as id FROM users WHERE role = $1', [USER_TYPE.ADMIN]);
    const recipients = adminResult.rows.map((row: { id: string }) => ({ id: row.id, role: USER_TYPE.ADMIN }));

    if (recipients.length === 0) {
      return;
    }

    const eventKey = `system_error:${Date.now()}:${req.method}:${req.originalUrl}`;

    await publishNotification({
      recipients,
      notification_type: NOTIFICATION_TYPE.SYSTEM_ERROR,
      priority: NOTIFICATION_PRIORITY.HIGH,
      title: 'System Error',
      message: `Unhandled error: ${err.message} (${req.method} ${req.originalUrl})`,
      related_entity_type: 'system',
      related_entity_id: null,
      action_url: null,
      event_key: eventKey,
    });
  } catch (notifyError) {
    console.error('Failed to publish system error notification:', notifyError);
  }
}

/**
 * Async error handler wrapper
 * Wraps async route handlers to catch errors automatically
 * 
 * @param fn - Async function to wrap
 * @returns Wrapped function
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
