/**
 * Deadlines Seed
 * 
 * Seeds the deadlines table with sample deadlines linked to admissions.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction, addDays } from './utils';
import { SeedResult } from './types';

/**
 * Deadline types
 */
const DEADLINE_TYPES: string[] = ['application', 'document_submission', 'payment', 'other'];

/**
 * Seed deadlines table
 */
export async function seedDeadlines(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    // Get all admissions
    const admissionsResult = await query('SELECT id, deadline FROM admissions WHERE is_active = true');
    const admissions = admissionsResult.rows;
    
    if (admissions.length === 0) {
      return {
        seedName: 'deadlines',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    for (const admission of admissions) {
      const baseDeadline = admission.deadline ? new Date(admission.deadline) : new Date();
      
      // Create 2-3 deadlines per admission
      const deadlineCount = Math.floor(Math.random() * 2) + 2; // 2 or 3
      
      for (let i = 0; i < deadlineCount; i++) {
        const deadlineType = DEADLINE_TYPES[i % DEADLINE_TYPES.length];
        const deadlineDate = addDays(baseDeadline, -(i * 7)); // Spread deadlines
        
        try {
          const result = await query(
            `INSERT INTO deadlines (
              admission_id, deadline_type, deadline_date, timezone, is_flexible, reminder_sent
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id`,
            [
              admission.id,
              deadlineType,
              deadlineDate,
              'UTC',
              i === 0, // First deadline might be flexible
              false,
            ]
          );
          
          if (result.rows.length > 0) {
            insertedCount++;
          }
        } catch (error: any) {
          // Skip duplicates
          if (error.code !== '23505') {
            console.error(`   ⚠️  Error inserting deadline:`, error.message);
          }
        }
      }
    }
    
    return {
      seedName: 'deadlines',
      success: true,
      recordCount: insertedCount,
    };
  });
}
