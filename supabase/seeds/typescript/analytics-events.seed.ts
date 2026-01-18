/**
 * Analytics Events Seed
 * 
 * Seeds the analytics_events table with sample analytics data.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction, randomElement } from './utils';
import { SeedResult } from './types';

const EVENT_TYPES: string[] = [
  'admission_viewed',
  'admission_created',
  'verification_completed',
  'verification_rejected',
  'deadline_approaching',
  'search_performed',
  'comparison_made',
];

const USER_TYPES: string[] = ['student', 'university', 'admin'];

export async function seedAnalyticsEvents(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    const admissionsResult = await query('SELECT id FROM admissions LIMIT 10');
    const admissions = admissionsResult.rows;
    
    if (admissions.length === 0) {
      return {
        seedName: 'analytics-events',
        success: true,
        recordCount: 0,
      };
    }
    
    let insertedCount = 0;
    
    // Create 15-20 analytics events
    const eventCount = Math.floor(Math.random() * 6) + 15;
    
    for (let i = 0; i < eventCount; i++) {
      const eventType = randomElement(EVENT_TYPES);
      const admission = randomElement(admissions);
      const userType = Math.random() > 0.3 ? randomElement(USER_TYPES) : null;
      
      try {
        await query(
          `INSERT INTO analytics_events (
            event_type, entity_type, entity_id, user_type
          )
          VALUES ($1, $2, $3, $4)`,
          [
            eventType,
            'admission',
            admission.id,
            userType,
          ]
        );
        insertedCount++;
      } catch (error: any) {
        // Continue on error
      }
    }
    
    return {
      seedName: 'analytics-events',
      success: true,
      recordCount: insertedCount,
    };
  });
}
