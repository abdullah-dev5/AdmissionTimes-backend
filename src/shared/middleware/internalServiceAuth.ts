import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/middleware/errorHandler';
import { config } from '@config/config';

const TOKEN_HEADER = 'x-internal-service-token';

/** Constant-time comparison so the token cannot be guessed byte by byte. */
const tokensMatch = (provided: string, expected: string): boolean => {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};

/** Reject requests whose x-internal-service-token does not match `getSecret()`. */
const requireSecret =
  (getSecret: () => string, name: string) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const configuredToken = getSecret();

      if (!configuredToken) {
        throw new AppError(`${name} is not configured`, 503);
      }

      const providedToken = String(req.headers[TOKEN_HEADER] || '').trim();
      if (!providedToken) {
        throw new AppError('Internal service token is required', 401);
      }

      if (!tokensMatch(providedToken, configuredToken)) {
        throw new AppError('Invalid internal service token', 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };

/** Scraper pipeline (SCRAPER_INTERNAL_SERVICE_TOKEN). */
export const requireInternalServiceToken = requireSecret(
  () => config.scraperIntegration.internalServiceToken,
  'Internal service token'
);

/** External scheduler calling /internal/jobs (CRON_SECRET). */
export const requireCronSecret = requireSecret(() => config.cronSecret, 'CRON_SECRET')
