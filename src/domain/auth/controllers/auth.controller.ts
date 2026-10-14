/**
 * Auth Domain - Controllers
 *
 * Validation runs in route middleware; errors propagate to the global handler.
 */

import { Request, Response } from 'express';
import { sendSuccess } from '@shared/utils/response';
import { AppError } from '@shared/middleware/errorHandler';
import * as authService from '../services/auth.service';
import { SignUpDTO, SignInDTO } from '../types/auth.types';

export const signUp = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.signUp(req.validated as SignUpDTO);
  sendSuccess(res, { user: result.user, message: result.message }, result.message, 201);
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.signIn(req.validated as SignInDTO);
  sendSuccess(
    res,
    {
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: result.expires_at,
    },
    result.message
  );
};

/**
 * Sessions are owned by Supabase: clients revoke them with
 * supabase.auth.signOut(). Kept for API compatibility.
 */
export const signOut = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, null, 'Signed out successfully');
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError('Unauthorized', 401);
  }
  const user = await authService.getCurrentUser(req.user.id);
  sendSuccess(res, user, 'User retrieved successfully');
};
