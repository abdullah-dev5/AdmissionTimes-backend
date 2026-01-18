/**
 * User Preferences Domain - Model Layer
 * 
 * Database access layer for user preferences.
 * Contains all raw SQL queries with parameterized statements.
 * 
 * Responsibilities:
 * - Execute database queries
 * - Return raw data (no transformation)
 * 
 * NO business logic - that belongs in the service layer.
 */

import { query } from '@db/connection';
import { UserPreferences, UpdateUserPreferencesDTO } from '../types/user-preferences.types';
import { DEFAULTS } from '../constants/user-preferences.constants';

/**
 * Find preferences by user ID
 * 
 * @param userId - User UUID
 * @returns User preferences record or null if not found
 */
export const findByUserId = async (userId: string): Promise<UserPreferences | null> => {
  const sql = 'SELECT * FROM user_preferences WHERE user_id = $1';
  const result = await query(sql, [userId]);
  return result.rows[0] || null;
};

/**
 * Create user preferences with defaults
 * 
 * @param userId - User UUID
 * @returns Created preferences record
 */
export const create = async (userId: string): Promise<UserPreferences> => {
  const sql = `
    INSERT INTO user_preferences (
      user_id,
      email_notifications_enabled,
      email_frequency,
      push_notifications_enabled,
      notification_categories,
      language,
      timezone,
      theme
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const params = [
    userId,
    DEFAULTS.EMAIL_NOTIFICATIONS_ENABLED,
    DEFAULTS.EMAIL_FREQUENCY,
    DEFAULTS.PUSH_NOTIFICATIONS_ENABLED,
    JSON.stringify(DEFAULTS.NOTIFICATION_CATEGORIES),
    DEFAULTS.LANGUAGE,
    DEFAULTS.TIMEZONE,
    DEFAULTS.THEME,
  ];

  const result = await query(sql, params);
  return result.rows[0];
};

/**
 * Update user preferences
 * 
 * @param userId - User UUID
 * @param data - Update data
 * @returns Updated preferences record or null if not found
 */
export const update = async (
  userId: string,
  data: UpdateUserPreferencesDTO
): Promise<UserPreferences | null> => {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.email_notifications_enabled !== undefined) {
    updates.push(`email_notifications_enabled = $${paramIndex++}`);
    params.push(data.email_notifications_enabled);
  }

  if (data.email_frequency !== undefined) {
    updates.push(`email_frequency = $${paramIndex++}`);
    params.push(data.email_frequency);
  }

  if (data.push_notifications_enabled !== undefined) {
    updates.push(`push_notifications_enabled = $${paramIndex++}`);
    params.push(data.push_notifications_enabled);
  }

  if (data.notification_categories !== undefined) {
    updates.push(`notification_categories = $${paramIndex++}`);
    params.push(JSON.stringify(data.notification_categories));
  }

  if (data.language !== undefined) {
    updates.push(`language = $${paramIndex++}`);
    params.push(data.language);
  }

  if (data.timezone !== undefined) {
    updates.push(`timezone = $${paramIndex++}`);
    params.push(data.timezone);
  }

  if (data.theme !== undefined) {
    updates.push(`theme = $${paramIndex++}`);
    params.push(data.theme);
  }

  if (updates.length === 0) {
    // No updates, return existing
    return findByUserId(userId);
  }

  updates.push(`updated_at = NOW()`);
  params.push(userId);

  const sql = `
    UPDATE user_preferences
    SET ${updates.join(', ')}
    WHERE user_id = $${paramIndex}
    RETURNING *
  `;

  const result = await query(sql, params);
  return result.rows[0] || null;
};

/**
 * Upsert user preferences (create or update)
 * 
 * @param userId - User UUID
 * @param data - Update data
 * @returns Created or updated preferences record
 */
export const upsert = async (
  userId: string,
  data: UpdateUserPreferencesDTO
): Promise<UserPreferences> => {
  // Try to update existing
  const updated = await update(userId, data);
  if (updated) {
    return updated;
  }

  // Create new with provided values or defaults
  const sql = `
    INSERT INTO user_preferences (
      user_id,
      email_notifications_enabled,
      email_frequency,
      push_notifications_enabled,
      notification_categories,
      language,
      timezone,
      theme
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const params = [
    userId,
    data.email_notifications_enabled ?? DEFAULTS.EMAIL_NOTIFICATIONS_ENABLED,
    data.email_frequency ?? DEFAULTS.EMAIL_FREQUENCY,
    data.push_notifications_enabled ?? DEFAULTS.PUSH_NOTIFICATIONS_ENABLED,
    JSON.stringify(data.notification_categories ?? DEFAULTS.NOTIFICATION_CATEGORIES),
    data.language ?? DEFAULTS.LANGUAGE,
    data.timezone ?? DEFAULTS.TIMEZONE,
    data.theme ?? DEFAULTS.THEME,
  ];

  const result = await query(sql, params);
  return result.rows[0];
};
