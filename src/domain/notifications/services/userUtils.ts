/**
 * User Utility Service
 * 
 * Provides lightweight helper functions for user data access
 * without full user domain dependencies.
 */

import { query } from '@db/connection';

/**
 * Fetch user's email address by user ID
 * @param userId - The UUID of the user
 * @returns Email address or null if not found
 */
export const getUserEmail = async (userId: string): Promise<string | null> => {
  try {
    const result = await query(
      'SELECT email FROM users WHERE id = $1 AND is_active = true LIMIT 1',
      [userId]
    );

    return result.rows[0]?.email || null;
  } catch (error) {
    console.error('[UserUtils] Error fetching user email:', error);
    return null;
  }
};

/**
 * Check if user has email notifications enabled
 * @param userId - The UUID of the user
 * @returns Object with email and whether email notifications are enabled
 */
export const getUserEmailPreferences = async (
  userId: string
): Promise<{ email: string | null; emailEnabled: boolean }> => {
  try {
    const result = await query(
      `SELECT 
        u.email,
        COALESCE(up.email_notifications_enabled, true) as email_enabled
      FROM users u
      LEFT JOIN user_preferences up ON up.user_id = u.id
      WHERE u.id = $1 AND u.is_active = true
      LIMIT 1`,
      [userId]
    );

    if (!result.rows[0]) {
      return { email: null, emailEnabled: false };
    }

    return {
      email: result.rows[0].email || null,
      emailEnabled: result.rows[0].email_enabled !== false,
    };
  } catch (error) {
    console.error('[UserUtils] Error fetching user email preferences:', error);
    return { email: null, emailEnabled: false };
  }
};
