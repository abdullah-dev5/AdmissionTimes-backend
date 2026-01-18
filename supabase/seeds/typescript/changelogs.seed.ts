/**
 * Changelogs Seed
 * 
 * Seeds the changelogs table with comprehensive change history
 * based on frontend mock data (admin change logs).
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

/**
 * Change log entries based on mock data
 */
const CHANGELOG_DATA = [
  {
    admission_title: 'BSCS Fall 2025',
    actor_type: 'university',
    action_type: 'updated',
    field_name: 'deadline',
    old_value: { deadline: '2025-07-10' },
    new_value: { deadline: '2025-07-15' },
    diff_summary: 'Deadline updated from 2025-07-10 to 2025-07-15',
  },
  {
    admission_title: 'BSCS Fall 2025',
    actor_type: 'university',
    action_type: 'updated',
    field_name: 'application_fee',
    old_value: { application_fee: 4500 },
    new_value: { application_fee: 5000 },
    diff_summary: 'Fee updated from Rs. 4,500 to Rs. 5,000',
  },
  {
    admission_title: 'MBA Executive',
    actor_type: 'admin',
    action_type: 'verified',
    field_name: null,
    old_value: { verification_status: 'pending' },
    new_value: { verification_status: 'verified' },
    diff_summary: 'Status changed from Pending Audit to Verified',
  },
  {
    admission_title: 'MS Data Science',
    actor_type: 'admin',
    action_type: 'rejected',
    field_name: null,
    old_value: { verification_status: 'pending' },
    new_value: { verification_status: 'rejected' },
    diff_summary: 'Status changed from Pending Audit to Rejected. Reason: Incomplete document',
  },
  {
    admission_title: 'BBA Honors',
    actor_type: 'university',
    action_type: 'disputed',
    field_name: null,
    old_value: { verification_status: 'verified' },
    new_value: { verification_status: 'disputed' },
    diff_summary: 'Status changed from Verified to Disputed. University requested recheck on deadline',
  },
  {
    admission_title: 'BSCS Fall 2025',
    actor_type: 'system',
    action_type: 'updated',
    field_name: 'deadline',
    old_value: { deadline: '2025-07-05' },
    new_value: { deadline: '2025-07-10' },
    diff_summary: 'Deadline updated by scraper from 2025-07-05 to 2025-07-10',
  },
  {
    admission_title: 'MS Data Science',
    actor_type: 'system',
    action_type: 'updated',
    field_name: 'application_fee',
    old_value: { application_fee: 5500 },
    new_value: { application_fee: 6000 },
    diff_summary: 'Fee updated by scraper from Rs. 5,500 to Rs. 6,000',
  },
  {
    admission_title: 'BBA Honors',
    actor_type: 'admin',
    action_type: 'updated',
    field_name: 'deadline',
    old_value: { deadline: '2025-07-15' },
    new_value: { deadline: '2025-07-20' },
    diff_summary: 'Deadline updated from 2025-07-15 to 2025-07-20. Status changed to Disputed for review',
  },
  {
    admission_title: 'MBA Executive',
    actor_type: 'university',
    action_type: 'updated',
    field_name: 'application_fee',
    old_value: { application_fee: 7000 },
    new_value: { application_fee: 7500 },
    diff_summary: 'Fee updated from Rs. 7,000 to Rs. 7,500. Overview expanded',
  },
  {
    admission_title: 'PhD Physics',
    actor_type: 'admin',
    action_type: 'updated',
    field_name: 'requirements',
    old_value: { eligibility: 'MS/MPhil in Physics.' },
    new_value: { eligibility: 'MS/MPhil in Physics or related field with minimum 3.0 CGPA.' },
    diff_summary: 'Eligibility requirements clarified based on university guidelines',
  },
];

/**
 * Seed changelogs table
 */
export async function seedChangelogs(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    // Get admissions
    const admissionsResult = await query('SELECT id, title FROM admissions LIMIT 20');
    const admissions = admissionsResult.rows;
    
    if (admissions.length === 0) {
      return {
        seedName: 'changelogs',
        success: true,
        recordCount: 0,
      };
    }
    
    // Create a map of admission titles to IDs
    const admissionMap = new Map<string, string>();
    admissions.forEach((adm: any) => {
      admissionMap.set(adm.title, adm.id);
    });
    
    let insertedCount = 0;
    
    // Create timestamps (recent dates)
    const baseDate = new Date('2025-02-08');
    const timestamps = [
      new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      new Date(baseDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      new Date(baseDate.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      new Date(baseDate.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      new Date(baseDate.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      new Date(baseDate.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      new Date(baseDate.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      new Date(baseDate.getTime() - 9 * 24 * 60 * 60 * 1000), // 9 days ago
      new Date(baseDate.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    ];
    
    for (let i = 0; i < CHANGELOG_DATA.length; i++) {
      const changelog = CHANGELOG_DATA[i];
      const admissionId = admissionMap.get(changelog.admission_title);
      
      if (!admissionId) {
        // Try to find by partial match or use first admission
        const matched = admissions.find((a: any) => 
          a.title.toLowerCase().includes(changelog.admission_title.toLowerCase().split(' ')[0])
        );
        if (!matched) continue;
        
        changelog.admission_title = matched.title;
      }
      
      const finalAdmissionId = admissionId || admissions[0].id;
      const timestamp = timestamps[i % timestamps.length];
      
      try {
        await query(
          `INSERT INTO changelogs (
            admission_id, actor_type, action_type, field_name,
            old_value, new_value, diff_summary, created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            finalAdmissionId,
            changelog.actor_type,
            changelog.action_type,
            changelog.field_name,
            JSON.stringify(changelog.old_value),
            JSON.stringify(changelog.new_value),
            changelog.diff_summary,
            timestamp,
          ]
        );
        insertedCount++;
      } catch (error: any) {
        // Continue on error
      }
    }
    
    // Also create some generic changelogs for other admissions
    for (let i = 0; i < Math.min(5, admissions.length); i++) {
      const admission = admissions[i];
      if (admissionMap.has(admission.title)) continue; // Skip if already processed
      
      try {
        await query(
          `INSERT INTO changelogs (
            admission_id, actor_type, action_type, field_name,
            old_value, new_value, diff_summary
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            admission.id,
            'university',
            'created',
            null,
            null,
            JSON.stringify({ status: 'draft' }),
            `Admission "${admission.title}" created`,
          ]
        );
        insertedCount++;
      } catch (error: any) {
        // Continue on error
      }
    }
    
    return {
      seedName: 'changelogs',
      success: true,
      recordCount: insertedCount,
    };
  });
}
