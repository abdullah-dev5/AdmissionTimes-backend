/**
 * Express Request extensions for AdmissionTimes.
 */

import type { UserContext } from './auth';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- global augmentation of Express.Request
  namespace Express {
    interface Request {
      /** Caller context set by apiAuth/jwtAuth (role and university from the database). */
      user?: UserContext;
      /** Body/query/params after Joi validation (set by shared/middleware/validation). */
      validated?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- shape depends on the route's schema
    }
  }
}

export {};
