/**
 * User Preferences Domain - Controller Layer
 * 
 * HTTP request/response handlers for user preferences endpoints.
 * 
 * Responsibilities:
 * - Extract request data (body, params, query)
 * - Call service methods
 * - Format responses using sendSuccess()
 * - Set appropriate HTTP status codes
 * - Handle async errors with try-catch
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '@shared/utils/response';
import * as userPreferencesService from '../services/user-preferences.service';
import { UpdateUserPreferencesDTO } from '../types/user-preferences.types';

/**
 * User context interface
 * Attached to requests by auth middleware
 */
interface UserContext {
  id: string | null;
  role: 'student' | 'university' | 'admin' | 'guest';
  university_id?: string | null;
}

/**
 * Get user preferences
 * 
 * GET /api/v1/users/me/preferences
 */
export const getUserPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    const preferences = await userPreferencesService.getUserPreferences(userContext);

    sendSuccess(res, preferences, 'User preferences retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update user preferences (PUT - full update)
 * 
 * PUT /api/v1/users/me/preferences
 */
export const updateUserPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as UpdateUserPreferencesDTO;
    const userContext = req.user as UserContext | undefined;

    const preferences = await userPreferencesService.updateUserPreferences(data, userContext);

    sendSuccess(res, preferences, 'User preferences updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Partial update user preferences (PATCH)
 * 
 * PATCH /api/v1/users/me/preferences
 */
export const patchUserPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as UpdateUserPreferencesDTO;
    const userContext = req.user as UserContext | undefined;

    const preferences = await userPreferencesService.patchUserPreferences(data, userContext);

    sendSuccess(res, preferences, 'User preferences updated successfully');
  } catch (error) {
    next(error);
  }
};
