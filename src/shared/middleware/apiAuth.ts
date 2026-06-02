/**
 * API authentication: JWT when Bearer token is present;
 * in non-production, fall back to x-user-id headers for local/dev sign-in.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '@config/config';
import { jwtAuth } from './jwtAuth';
import { devHeaderAuth } from './devHeaderAuth';

const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
};

export const apiAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractToken(req);

  if (token) {
    jwtAuth(req, res, next);
    return;
  }

  if (config.env !== 'production') {
    devHeaderAuth(req, res, next);
    return;
  }

  jwtAuth(req, res, next);
};
