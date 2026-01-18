/**
 * User Preferences Seed
 * 
 * Seeds the user_preferences table with sample user preferences.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

export async function seedUserPreferences(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    const usersResult = await query('SELECT id FROM users LIMIT 8');
    const users = usersResult.rows;
    
    if (users.length === 0) {
      return {
        seedName: 'user-preferences',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    for (const user of users) {
      try {
        await query(
          `INSERT INTO user_preferences (
            user_id, email_notifications_enabled, email_frequency,
            push_notifications_enabled, notification_categories, language, theme
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id) DO NOTHING`,
          [
            user.id,
            true,
            'weekly',
            true,
            JSON.stringify({ verification: true, deadline: true, system: true, update: true }),
            'en',
            'light',
          ]
        );
        insertedCount++;
      } catch (error: any) {
        // Skip duplicates
      }
    }
    
    return {
      seedName: 'user-preferences',
      success: true,
      recordCount: insertedCount,
    };
  });
}
