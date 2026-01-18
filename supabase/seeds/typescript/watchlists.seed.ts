/**
 * Watchlists Seed
 * 
 * Seeds the watchlists table with sample watchlist entries.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

export async function seedWatchlists(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    const usersResult = await query('SELECT id FROM users WHERE role = $1 LIMIT 5', ['student']);
    const users = usersResult.rows;
    
    const admissionsResult = await query('SELECT id FROM admissions WHERE is_active = true LIMIT 10');
    const admissions = admissionsResult.rows;
    
    if (users.length === 0 || admissions.length === 0) {
      return {
        seedName: 'watchlists',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    for (const user of users) {
      // Each user watches 2-4 admissions
      const watchCount = Math.floor(Math.random() * 3) + 2;
      const watchedAdmissions = admissions.slice(0, watchCount);
      
      for (const admission of watchedAdmissions) {
        try {
          await query(
            `INSERT INTO watchlists (user_id, admission_id, notes)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, admission_id) DO NOTHING`,
            [
              user.id,
              admission.id,
              `Interested in ${admission.id.substring(0, 8)}...`,
            ]
          );
          insertedCount++;
        } catch (error: any) {
          // Skip duplicates
        }
      }
    }
    
    return {
      seedName: 'watchlists',
      success: true,
      recordCount: insertedCount,
    };
  });
}
