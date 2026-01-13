/**
 * Authentication Middleware (Mock/Placeholder)
 * 
 * ⚠️ TEMP AUTH — WILL BE ENABLED LATER
 * This is a placeholder that does NOT validate or block requests.
 * 
 * Purpose:
 * - Attach user context to requests for development
 * - Prepare structure for future Supabase Auth integration
 * - Never blocks requests (always calls next())
 * 
 * Usage:
 * - Set headers in development:
 *   - x-user-id: User UUID (optional)
 *   - x-user-role: 'student' | 'university' | 'admin' (optional)
 *   - x-university-id: University UUID (optional, for university users)
 * 
 * Default behavior:
 * - If no headers provided: { id: null, role: 'guest', university_id: null }
 * - Always allows request to proceed
 */

import { Request, Response, NextFunction } from 'express';
import { UserContext } from '../../domain/admissions/types/admissions.types';

/**
 * Extend Express Request to include user context
 */
declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

/**
 * Mock authentication middleware
 * 
 * Attaches user context from headers without validation.
 * This allows development and testing without real authentication.
 * 
 * @param req - Express request object
 * @param _res - Express response object (unused)
 * @param next - Express next function
 */
export const mockAuth = (req: Request, _res: Response, next: NextFunction): void => {
  // Extract user context from headers (development only)
  const userId = req.headers['x-user-id'] as string | undefined;
  const userRole = req.headers['x-user-role'] as 'student' | 'university' | 'admin' | undefined;
  const universityId = req.headers['x-university-id'] as string | undefined;

  // Attach user context to request
  // Default to guest if no headers provided
  req.user = {
    id: userId || null,
    role: userRole || 'guest',
    university_id: universityId || null,
  };

  // Always continue - never blocks requests
  next();
};
