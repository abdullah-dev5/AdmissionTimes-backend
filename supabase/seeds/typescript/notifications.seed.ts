/**
 * Notifications Seed
 * 
 * Seeds the notifications table with comprehensive notification data
 * based on frontend mock data (student, admin, and university notifications).
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

/**
 * Student notifications based on mock data
 */
const STUDENT_NOTIFICATIONS = [
  {
    user_type: 'student',
    category: 'deadline',
    priority: 'high',
    title: 'Application Deadline Approaching: MS in Data Science',
    message: 'Your application for NUST MS Data Science is due in 3 days. Don\'t forget to submit your final documents.',
    related_entity_type: 'admission',
    is_read: false,
    action_url: '/program/2',
  },
  {
    user_type: 'student',
    category: 'update',
    priority: 'medium',
    title: 'Admission Updated: BS Computer Science 2025',
    message: 'FAST University has updated admission details for BS Computer Science. Click to view changes.',
    related_entity_type: 'admission',
    is_read: false,
    action_url: '/program/1',
  },
  {
    user_type: 'student',
    category: 'verification',
    priority: 'medium',
    title: 'Documents Verified Successfully',
    message: 'Your academic transcripts for LUMS PhD in Management have been verified.',
    related_entity_type: 'admission',
    is_read: false,
    action_url: '/program/3',
  },
  {
    user_type: 'student',
    category: 'system',
    priority: 'low',
    title: 'System Update: New Features Available',
    message: 'We\'ve updated our platform with new tools to help you track your applications more efficiently.',
    is_read: false,
  },
  {
    user_type: 'student',
    category: 'update',
    priority: 'medium',
    title: 'New Program Added: BS Cyber Security',
    message: 'Air University has added a new BS Cyber Security program. Check it out if you\'re interested in cybersecurity.',
    related_entity_type: 'admission',
    is_read: true,
    action_url: '/program/6',
  },
  {
    user_type: 'student',
    category: 'deadline',
    priority: 'urgent',
    title: 'Deadline Reminder: IBA Karachi MBA',
    message: 'The application deadline for IBA Karachi MBA is tomorrow. Make sure all documents are submitted.',
    related_entity_type: 'admission',
    is_read: true,
    action_url: '/program/5',
  },
  {
    user_type: 'student',
    category: 'update',
    priority: 'medium',
    title: 'Deadline Extended: NUST BS Aerospace Engineering',
    message: 'NUST has extended the deadline for BS Aerospace Engineering to December 5, 2025. You have more time to apply!',
    related_entity_type: 'admission',
    is_read: false,
    action_url: '/program/16',
  },
  {
    user_type: 'student',
    category: 'deadline',
    priority: 'high',
    title: 'New Program Available: Quaid-e-Azam University MS Mathematics',
    message: 'Applications are now open for MS Mathematics at Quaid-e-Azam University. Deadline: November 15, 2025.',
    related_entity_type: 'admission',
    is_read: false,
    action_url: '/program/13',
  },
  {
    user_type: 'student',
    category: 'update',
    priority: 'medium',
    title: 'Deadline Updated: University of Karachi BS Biotechnology',
    message: 'The deadline for BS Biotechnology has been updated to November 25, 2025. Please note the new date.',
    related_entity_type: 'admission',
    is_read: false,
    action_url: '/program/14',
  },
  {
    user_type: 'student',
    category: 'deadline',
    priority: 'medium',
    title: 'Upcoming Deadline: COMSATS MS Computer Engineering',
    message: 'The application deadline for MS Computer Engineering at COMSATS is December 15, 2025. Start preparing your documents.',
    related_entity_type: 'admission',
    is_read: true,
    action_url: '/program/18',
  },
];

/**
 * Admin notifications based on mock data
 */
const ADMIN_NOTIFICATIONS = [
  {
    user_type: 'admin',
    category: 'verification',
    priority: 'medium',
    title: 'Admission Verified',
    message: 'Admission \'BSCS Fall 2025\' from FAST University has been verified by Admin.',
    related_entity_type: 'admission',
    is_read: true,
  },
  {
    user_type: 'admin',
    category: 'verification',
    priority: 'high',
    title: 'New Admission Uploaded',
    message: 'FAST University uploaded a new admission: \'MS Data Science\' requiring verification.',
    related_entity_type: 'admission',
    is_read: true,
  },
  {
    user_type: 'admin',
    category: 'system',
    priority: 'medium',
    title: 'System Maintenance Scheduled',
    message: 'Scheduled system maintenance will occur on February 12, 2025 at 2:00 AM. Expected downtime: 30 minutes.',
    is_read: true,
  },
  {
    user_type: 'admin',
    category: 'system',
    priority: 'high',
    title: 'Scraper Error Detected',
    message: 'Scraper failed to fetch data from NUST website. Error: Connection timeout. Retry scheduled.',
    is_read: true,
  },
  {
    user_type: 'admin',
    category: 'verification',
    priority: 'medium',
    title: 'Admission Rejected',
    message: 'Admission \'MS Data Science\' from FAST University was rejected by Admin. Reason: Incomplete fee structure.',
    related_entity_type: 'admission',
    is_read: false,
  },
  {
    user_type: 'admin',
    category: 'verification',
    priority: 'high',
    title: 'New Admission Uploaded',
    message: 'LUMS uploaded a new admission: \'MBA Executive\' requiring verification.',
    related_entity_type: 'admission',
    is_read: false,
  },
  {
    user_type: 'admin',
    category: 'verification',
    priority: 'medium',
    title: 'Admission Disputed',
    message: 'Admission \'BBA Honors\' from IBA has been marked as disputed. University requested recheck on deadline.',
    related_entity_type: 'admission',
    is_read: false,
  },
  {
    user_type: 'admin',
    category: 'system',
    priority: 'low',
    title: 'Scraper Success',
    message: 'Scraper successfully updated 3 admissions from FAST University website.',
    is_read: false,
  },
  {
    user_type: 'admin',
    category: 'verification',
    priority: 'high',
    title: 'New Admission Uploaded',
    message: 'NUST uploaded a new admission: \'PhD Physics\' requiring verification.',
    related_entity_type: 'admission',
    is_read: false,
  },
  {
    user_type: 'admin',
    category: 'system',
    priority: 'low',
    title: 'Database Backup Completed',
    message: 'Daily database backup completed successfully. Backup size: 2.5 GB. Stored in secure location.',
    is_read: false,
  },
];

/**
 * University notifications based on mock data
 */
const UNIVERSITY_NOTIFICATIONS = [
  {
    user_type: 'university',
    category: 'verification',
    priority: 'medium',
    title: 'Audit Update',
    message: 'Your admission \'BSCS Fall 2025\' is under review.',
    related_entity_type: 'admission',
    is_read: false,
  },
  {
    user_type: 'university',
    category: 'system',
    priority: 'low',
    title: 'System Alert',
    message: 'Scheduled maintenance on 12th Feb, 2 AM.',
    is_read: true,
  },
  {
    user_type: 'university',
    category: 'update',
    priority: 'medium',
    title: 'Admission Update',
    message: 'Admission \'BBA Honors\' has been marked as Disputed.',
    related_entity_type: 'admission',
    is_read: false,
  },
  {
    user_type: 'university',
    category: 'verification',
    priority: 'medium',
    title: 'Verification Complete',
    message: 'Your admission \'MBA Executive\' has been verified.',
    related_entity_type: 'admission',
    is_read: false,
  },
  {
    user_type: 'university',
    category: 'verification',
    priority: 'high',
    title: 'Verification Result',
    message: 'Your admission \'MS Data Science\' was rejected. Reason: Incomplete document.',
    related_entity_type: 'admission',
    is_read: false,
  },
];

/**
 * Seed notifications table
 */
export async function seedNotifications(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    // Get user IDs
    const studentUsers = await query('SELECT id FROM users WHERE role = $1 LIMIT 3', ['student']);
    const adminUsers = await query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['admin']);
    const universityUsers = await query('SELECT id FROM users WHERE role = $1 LIMIT 2', ['university']);
    
    // Get admission IDs for related notifications
    const admissionsResult = await query('SELECT id FROM admissions LIMIT 20');
    const admissionIds = admissionsResult.rows.map((r: any) => r.id);
    
    let insertedCount = 0;
    
    // Seed student notifications
    for (let i = 0; i < STUDENT_NOTIFICATIONS.length; i++) {
      const notif = STUDENT_NOTIFICATIONS[i];
      const userId = studentUsers.rows[i % studentUsers.rows.length]?.id || null;
      const admissionId = notif.related_entity_type === 'admission' && admissionIds.length > 0
        ? admissionIds[i % admissionIds.length]
        : null;
      
      try {
        await query(
          `INSERT INTO notifications (
            user_id, user_type, category, priority, title, message,
            related_entity_type, related_entity_id, is_read, action_url
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            userId,
            notif.user_type,
            notif.category,
            notif.priority,
            notif.title,
            notif.message,
            notif.related_entity_type || null,
            admissionId,
            notif.is_read,
            notif.action_url || null,
          ]
        );
        insertedCount++;
      } catch (error: any) {
        // Continue on error
      }
    }
    
    // Seed admin notifications
    for (let i = 0; i < ADMIN_NOTIFICATIONS.length; i++) {
      const notif = ADMIN_NOTIFICATIONS[i];
      const userId = adminUsers.rows[0]?.id || null;
      const admissionId = notif.related_entity_type === 'admission' && admissionIds.length > 0
        ? admissionIds[i % admissionIds.length]
        : null;
      
      try {
        await query(
          `INSERT INTO notifications (
            user_id, user_type, category, priority, title, message,
            related_entity_type, related_entity_id, is_read
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            notif.user_type,
            notif.category,
            notif.priority,
            notif.title,
            notif.message,
            notif.related_entity_type || null,
            admissionId,
            notif.is_read,
          ]
        );
        insertedCount++;
      } catch (error: any) {
        // Continue on error
      }
    }
    
    // Seed university notifications
    for (let i = 0; i < UNIVERSITY_NOTIFICATIONS.length; i++) {
      const notif = UNIVERSITY_NOTIFICATIONS[i];
      const userId = universityUsers.rows[i % universityUsers.rows.length]?.id || null;
      const admissionId = notif.related_entity_type === 'admission' && admissionIds.length > 0
        ? admissionIds[i % admissionIds.length]
        : null;
      
      try {
        await query(
          `INSERT INTO notifications (
            user_id, user_type, category, priority, title, message,
            related_entity_type, related_entity_id, is_read
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            notif.user_type,
            notif.category,
            notif.priority,
            notif.title,
            notif.message,
            notif.related_entity_type || null,
            admissionId,
            notif.is_read,
          ]
        );
        insertedCount++;
      } catch (error: any) {
        // Continue on error
      }
    }
    
    return {
      seedName: 'notifications',
      success: true,
      recordCount: insertedCount,
    };
  });
}
