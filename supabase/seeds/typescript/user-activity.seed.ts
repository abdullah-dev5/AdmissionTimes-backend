/**
 * User Activity Seed
 * 
 * Seeds the user_activity table with sample activity logs.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction, randomElement } from './utils';
import { SeedResult } from './types';

const ACTIVITY_TYPES: string[] = ['viewed', 'searched', 'compared', 'watchlisted'];

export async function seedUserActivity(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    const usersResult = await query('SELECT id, role FROM users WHERE role = $1 LIMIT 5', ['student']);
    const users = usersResult.rows;
    
    const admissionsResult = await query('SELECT id FROM admissions LIMIT 10');
    const admissions = admissionsResult.rows;
    
    if (users.length === 0 || admissions.length === 0) {
      return {
        seedName: 'user-activity',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    for (const user of users) {
      // Create 3-5 activity entries per user
      const activityCount = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < activityCount; i++) {
        const activityType = randomElement(ACTIVITY_TYPES);
        const admission = randomElement(admissions);
        
        try {
          await query(
            `INSERT INTO user_activity (
              user_id, user_type, activity_type, entity_type, entity_id
            )
            VALUES ($1, $2, $3, $4, $5)`,
            [
              user.id,
              user.role,
              activityType,
              'admission',
              admission.id,
            ]
          );
          insertedCount++;
        } catch (error: any) {
          // Continue on error
        }
      }
    }
    
    return {
      seedName: 'user-activity',
      success: true,
      recordCount: insertedCount,
    };
  });
}
