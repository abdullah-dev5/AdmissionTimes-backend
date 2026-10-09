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

export const requireInternalServiceToken = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const configuredToken = config.scraperIntegration.internalServiceToken;

    if (!configuredToken) {
      throw new AppError('Internal service token is not configured', 503);
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
