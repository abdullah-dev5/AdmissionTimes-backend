/**
 * Changelogs Seed
 * 
 * Seeds the changelogs table with sample change history.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction, randomElement } from './utils';
import { SeedResult } from './types';

const ACTION_TYPES: string[] = ['created', 'updated', 'verified', 'rejected', 'status_changed'];
const ACTOR_TYPES: string[] = ['admin', 'university', 'system'];

export async function seedChangelogs(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    const admissionsResult = await query('SELECT id FROM admissions LIMIT 10');
    const admissions = admissionsResult.rows;
    
    if (admissions.length === 0) {
      return {
        seedName: 'changelogs',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    for (const admission of admissions) {
      // Create 1-2 changelog entries per admission
      const entryCount = Math.floor(Math.random() * 2) + 1;
      
      for (let i = 0; i < entryCount; i++) {
        const actionType = randomElement(ACTION_TYPES);
        const actorType = randomElement(ACTOR_TYPES);
        
        try {
          await query(
            `INSERT INTO changelogs (
              admission_id, actor_type, action_type, field_name,
              old_value, new_value, diff_summary
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              admission.id,
              actorType,
              actionType,
              actionType === 'updated' ? 'verification_status' : null,
              actionType === 'updated' ? JSON.stringify({ verification_status: 'pending' }) : null,
              actionType === 'updated' ? JSON.stringify({ verification_status: 'verified' }) : null,
              `Changed verification status from pending to verified`,
            ]
          );
          insertedCount++;
        } catch (error: any) {
          // Continue on error
        }
      }
    }
    
    return {
      seedName: 'changelogs',
      success: true,
      recordCount: insertedCount,
    };
  });
}
