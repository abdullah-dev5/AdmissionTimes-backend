/**
 * Express Request extensions for AdmissionTimes.
 */

import type { UserContext } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** Caller context set by apiAuth/jwtAuth (role and university from the database). */
      user?: UserContext;
    }
  }
}

export {};
