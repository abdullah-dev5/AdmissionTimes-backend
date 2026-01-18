/**
 * Watchlists Seed
 * 
 * Seeds the watchlists table with comprehensive watchlist data
 * based on frontend mock data (saved admissions from student data).
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

/**
 * Watchlist entries based on saved admissions from mock data
 */
const WATCHLIST_NOTES = [
  'Interested in this program for its strong industry connections',
  'Top choice - excellent placement record',
  'Considering for research opportunities',
  'Good match with my academic background',
  'Interested in specialization tracks',
  'Strong curriculum and faculty',
  'Considering for future application',
  'Excellent facilities and resources',
];

/**
 * Seed watchlists table
 */
export async function seedWatchlists(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    // Get student users
    const usersResult = await query('SELECT id FROM users WHERE role = $1 LIMIT 5', ['student']);
    const users = usersResult.rows;
    
    // Get active admissions
    const admissionsResult = await query('SELECT id, title FROM admissions WHERE is_active = true LIMIT 20');
    const admissions = admissionsResult.rows;
    
    if (users.length === 0 || admissions.length === 0) {
      return {
        seedName: 'watchlists',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    // Each student watches 3-6 admissions (based on saved admissions pattern)
    for (const user of users) {
      const watchCount = Math.floor(Math.random() * 4) + 3; // 3-6 admissions
      const watchedAdmissions = admissions.slice(0, watchCount);
      
      for (let i = 0; i < watchedAdmissions.length; i++) {
        const admission = watchedAdmissions[i];
        const notes = WATCHLIST_NOTES[i % WATCHLIST_NOTES.length];
        const alertOptIn = Math.random() > 0.3; // 70% opt-in rate
        
        try {
          await query(
            `INSERT INTO watchlists (user_id, admission_id, notes, alert_opt_in)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, admission_id) DO NOTHING`,
            [
              user.id,
              admission.id,
              notes,
              alertOptIn,
            ]
          );
          insertedCount++;
        } catch (error: any) {
          // Skip duplicates or errors
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
