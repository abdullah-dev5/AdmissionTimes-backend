/**
 * User Preferences Domain - Service Layer
 * 
 * Business logic and orchestration for user preferences.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Get and update preferences
 * - Return defaults if preferences don't exist
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as userPreferencesModel from '../models/user-preferences.model';
import {
  UserPreferences,
  UpdateUserPreferencesDTO,
} from '../types/user-preferences.types';
import { DEFAULTS } from '../constants/user-preferences.constants';

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
 * Get default preferences
 * 
 * @param userId - User UUID
 * @returns Default preferences object
 */
const getDefaults = (userId: string): UserPreferences => {
  return {
    id: '',
    user_id: userId,
    email_notifications_enabled: DEFAULTS.EMAIL_NOTIFICATIONS_ENABLED,
    email_frequency: DEFAULTS.EMAIL_FREQUENCY,
    push_notifications_enabled: DEFAULTS.PUSH_NOTIFICATIONS_ENABLED,
    notification_categories: DEFAULTS.NOTIFICATION_CATEGORIES,
    language: DEFAULTS.LANGUAGE,
    timezone: DEFAULTS.TIMEZONE,
    theme: DEFAULTS.THEME,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Get user preferences (with defaults if not exist)
 * 
 * @param userContext - User context
 * @returns User preferences record
 * @throws AppError if user not authenticated
 */
export const getUserPreferences = async (
  userContext?: UserContext
): Promise<UserPreferences> => {
  // Access control: users must be authenticated
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  const preferences = await userPreferencesModel.findByUserId(userContext.id);

  // Return defaults if preferences don't exist
  if (!preferences) {
    return getDefaults(userContext.id);
  }

  return preferences;
};

/**
 * Update user preferences (PUT - full update)
 * 
 * @param data - Update data
 * @param userContext - User context
 * @returns Updated preferences record
 * @throws AppError if user not authenticated
 */
export const updateUserPreferences = async (
  data: UpdateUserPreferencesDTO,
  userContext?: UserContext
): Promise<UserPreferences> => {
  // Access control: users must be authenticated
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  // Upsert preferences (create if not exist, update if exist)
  return await userPreferencesModel.upsert(userContext.id, data);
};

/**
 * Partial update user preferences (PATCH)
 * 
 * @param data - Partial update data
 * @param userContext - User context
 * @returns Updated preferences record
 * @throws AppError if user not authenticated
 */
export const patchUserPreferences = async (
  data: UpdateUserPreferencesDTO,
  userContext?: UserContext
): Promise<UserPreferences> => {
  // Access control: users must be authenticated
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  // Upsert preferences (create if not exist, update if exist)
  return await userPreferencesModel.upsert(userContext.id, data);
};
