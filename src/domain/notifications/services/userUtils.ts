/**
 * User Utility Service
 * 
 * Provides lightweight helper functions for user data access
 * without full user domain dependencies.
 */

import { query } from '@db/connection';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('userUtils');

export interface UserNotificationPreferences {
  email: string | null;
  emailEnabled: boolean;
  pushEnabled: boolean;
  categories: {
    verification: boolean;
    deadline: boolean;
    system: boolean;
    update: boolean;
  };
}

export const getUserNotificationPreferences = async (
  userId: string
): Promise<UserNotificationPreferences> => {
  try {
    const result = await query(
      `SELECT
        u.email,
        COALESCE(up.email_notifications_enabled, true) as email_enabled,
        COALESCE(up.push_notifications_enabled, true) as push_enabled,
        COALESCE(up.notification_categories, '{"verification": true, "deadline": true, "system": true, "update": true}'::jsonb) as categories
      FROM users u
      LEFT JOIN user_preferences up ON up.user_id = u.id
      WHERE u.id = $1 AND COALESCE(u.status, 'active') = 'active'
      LIMIT 1`,
      [userId]
    );

    if (!result.rows[0]) {
      return {
        email: null,
        emailEnabled: false,
        pushEnabled: false,
        categories: {
          verification: true,
          deadline: true,
          system: true,
          update: true,
        },
      };
    }

    const rawCategories = result.rows[0].categories || {};

    return {
      email: result.rows[0].email || null,
      emailEnabled: result.rows[0].email_enabled !== false,
      pushEnabled: result.rows[0].push_enabled !== false,
      categories: {
        verification: rawCategories.verification !== false,
        deadline: rawCategories.deadline !== false,
        system: rawCategories.system !== false,
        update: rawCategories.update !== false,
      },
    };
  } catch (error) {
    log.error('Error fetching user notification preferences:', error);
    return {
      email: null,
      emailEnabled: false,
      pushEnabled: false,
      categories: {
        verification: true,
        deadline: true,
        system: true,
        update: true,
      },
    };
  }
};
