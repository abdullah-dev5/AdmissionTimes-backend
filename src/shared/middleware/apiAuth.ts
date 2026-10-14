/**
 * API authentication entry point.
 *
 * Always requires a verified Supabase JWT. The `x-user-id` header shortcut is
 * available only when ALLOW_DEV_HEADER_AUTH=true outside production, and only
 * for requests that carry no Authorization header.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '@config/config';
import { jwtAuth, extractBearerToken } from './jwtAuth';
import { devHeaderAuth } from './devHeaderAuth';

export const apiAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!extractBearerToken(req) && config.devHeaderAuthEnabled && req.headers['x-user-id']) {
    void devHeaderAuth(req, res, next);
    return;
  }
  void jwtAuth(req, res, next);
};
