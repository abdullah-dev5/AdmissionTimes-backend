/**
 * Express Request extensions for AdmissionTimes
 * 
 * This file extends the Express Request interface to include
 * application-specific properties like user context from JWT.
 */

import { UserContext } from '@domain/admissions/types/admissions.types';

declare global {
  namespace Express {
    interface Request {
      /**
       * User context attached by authentication middleware
       * 
       * Populated by:
       * - jwtAuth: From JWT token claims
       * - optionalJwtAuth: From JWT token or empty if no token
       * - mockAuth: From request headers (development only)
       */
      user?: UserContext;
    }
  }
}
