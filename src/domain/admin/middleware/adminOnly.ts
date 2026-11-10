/**
 * Admin Middleware - Authorization
 * 
 * Middleware to protect admin routes.
 * Verifies user is authenticated and has admin role.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/middleware/errorHandler';
import { UserContext } from '../types/admin.types';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('adminOnly');

/**
 * Check if user is admin
 * Applied to all /admin routes
 */
export const adminOnly = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const userContext = req.user as UserContext | undefined;

    log.debug('Checking admin access:', {
      hasUserContext: !!userContext,
      userId: userContext?.id,
      userRole: userContext?.role,
      endpoint: req.path,
      method: req.method,
    });

    // Check if user exists
    if (!userContext || !userContext.id) {
      log.warn('No user context found');
      throw new AppError('Authentication required', 401);
    }

    // Check if admin
    if (userContext.role !== 'admin') {
      log.warn(`User is not admin:`, {
        userId: userContext.id,
        userRole: userContext.role,
        endpoint: req.path,
        method: req.method,
      });

      throw new AppError('Admin access required', 403);
    }

    log.debug('User is admin - access granted:', {
      userId: userContext.id,
    });

    // User is authenticated admin, proceed
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional admin check (doesn't throw if not admin, just logs)
 * Useful for auditing non-admin access attempts
 */
export const logAdminAccess = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const userContext = req.user as UserContext | undefined;

  if (userContext) {
    log.debug(`Admin endpoint access:`, {
      userId: userContext.id,
      userRole: userContext.role,
      endpoint: req.path,
      method: req.method,
    });
  }

  next();
};
