/**
 * Notifications Seed
 * 
 * Seeds the notifications table with sample notifications.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction, randomElement } from './utils';
import { SeedResult } from './types';

const CATEGORIES: string[] = ['verification', 'deadline', 'system', 'update'];
const PRIORITIES: string[] = ['low', 'medium', 'high', 'urgent'];

export async function seedNotifications(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    const usersResult = await query('SELECT id, role FROM users LIMIT 5');
    const users = usersResult.rows;
    
    if (users.length === 0) {
      return {
        seedName: 'notifications',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    for (const user of users) {
      // Create 2-3 notifications per user
      const notificationCount = Math.floor(Math.random() * 2) + 2;
      
      for (let i = 0; i < notificationCount; i++) {
        const category = randomElement(CATEGORIES);
        const priority = randomElement(PRIORITIES);
        const isRead = Math.random() > 0.5;
        
        try {
          await query(
            `INSERT INTO notifications (
              user_id, user_type, category, priority, title, message,
              is_read, read_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              user.id,
              user.role,
              category,
              priority,
              `${category.charAt(0).toUpperCase() + category.slice(1)} Notification`,
              `This is a sample ${category} notification with ${priority} priority.`,
              isRead,
              isRead ? new Date() : null,
            ]
          );
          insertedCount++;
        } catch (error: any) {
          // Continue on error
        }
      }
    }
    
    return {
      seedName: 'notifications',
      success: true,
      recordCount: insertedCount,
    };
  });
}
