/**
 * User Activity Seed
 * 
 * Seeds the user_activity table with comprehensive activity data
 * based on frontend mock data (student activities).
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

/**
 * Activity entries based on mock data patterns
 */
const ACTIVITY_DATA = [
  { activity_type: 'viewed', entity_type: 'admission', metadata: { page: '/university/dashboard' } },
  { activity_type: 'searched', entity_type: 'admission', metadata: { query: 'computer science', results: 15 } },
  { activity_type: 'viewed', entity_type: 'admission', metadata: { admissionId: '1', admissionTitle: 'BSCS Fall 2025' } },
  { activity_type: 'viewed', entity_type: 'admission', metadata: { page: '/admin/verification' } },
  { activity_type: 'viewed', entity_type: 'admission', metadata: { admissionId: '7', admissionTitle: 'MBA Executive' } },
  { activity_type: 'searched', entity_type: 'admission', metadata: { query: 'engineering', results: 23 } },
  { activity_type: 'viewed', entity_type: 'admission', metadata: { page: '/admin/scraper-logs' } },
  { activity_type: 'viewed', entity_type: 'admission', metadata: { admissionId: '3', admissionTitle: 'PhD in Management' } },
  { activity_type: 'compared', entity_type: 'admission', metadata: { admissionIds: ['1', '5'] } },
  { activity_type: 'watchlisted', entity_type: 'admission', metadata: { admissionId: '5' } },
];

/**
 * Seed user_activity table
 */
export async function seedUserActivity(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    // Get users
    const usersResult = await query('SELECT id, role FROM users LIMIT 10');
    const users = usersResult.rows;
    
    // Get admissions
    const admissionsResult = await query('SELECT id FROM admissions LIMIT 20');
    const admissions = admissionsResult.rows;
    
    if (users.length === 0 || admissions.length === 0) {
      return {
        seedName: 'user-activity',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    // Create activities for each user
    for (const user of users) {
      // Each user gets 3-5 activities
      const activityCount = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < activityCount; i++) {
        const activity = ACTIVITY_DATA[i % ACTIVITY_DATA.length];
        const admission = admissions[i % admissions.length];
        
        // Determine entity_id based on activity type
        let entityId = admission.id;
        if (activity.activity_type === 'searched') {
          // For searches, use first admission ID
          entityId = admissions[0].id;
        }
        
        try {
          await query(
            `INSERT INTO user_activity (
              user_id, user_type, activity_type, entity_type, entity_id, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              user.id,
              user.role,
              activity.activity_type,
              activity.entity_type,
              entityId,
              JSON.stringify(activity.metadata || {}),
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
