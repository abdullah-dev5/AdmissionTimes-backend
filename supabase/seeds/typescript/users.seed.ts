/**
 * Users Seed
 * 
 * Seeds the users table with sample user accounts.
 * Creates students, universities, and admins.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

/**
 * Sample user data
 */
const USERS_DATA = [
  // Students
  { role: 'student', display_name: 'Ahmed Khan', status: 'active' },
  { role: 'student', display_name: 'Fatima Ali', status: 'active' },
  { role: 'student', display_name: 'Hassan Malik', status: 'active' },
  { role: 'student', display_name: 'Sara Khan', status: 'active' },
  { role: 'student', display_name: 'Omar Sheikh', status: 'active' },
  { role: 'student', display_name: 'Ayesha Ahmed', status: 'active' },
  
  // Universities
  { role: 'university', display_name: 'National University', status: 'active' },
  { role: 'university', display_name: 'Tech Institute', status: 'active' },
  { role: 'university', display_name: 'Business School', status: 'active' },
  
  // Admins
  { role: 'admin', display_name: 'Admin User', status: 'active' },
];

/**
 * Seed users table
 */
export async function seedUsers(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    let insertedCount = 0;
    
    for (const user of USERS_DATA) {
      try {
        const result = await query(
          `INSERT INTO users (role, display_name, status)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING id`,
          [user.role, user.display_name, user.status]
        );
        
        if (result.rows.length > 0) {
          insertedCount++;
        }
      } catch (error: any) {
        // Skip if user already exists (idempotent)
        if (error.code !== '23505') { // Unique violation
          throw error;
        }
      }
    }
    
    return {
      seedName: 'users',
      success: true,
      recordCount: insertedCount,
    };
  });
}
