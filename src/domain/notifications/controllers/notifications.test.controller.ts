import type { Request, Response } from 'express';
import { publishNotification } from '../services/notificationPublisher';
import { NOTIFICATION_TYPE, NOTIFICATION_PRIORITY } from '@config/constants';
import { query } from '@db/connection';

/**
 * Test endpoint to verify notification creation
 * POST /api/v1/notifications/test
 * 
 * This endpoint helps debug notification creation by:
 * 1. Testing database connection
 * 2. Creating a test notification
 * 3. Verifying it was saved
 * 4. Checking RLS policies
 */
export const testNotificationCreation = async (_req: Request, res: Response): Promise<void> => {
  try {
    const testResults: any = {
      timestamp: new Date().toISOString(),
      steps: [],
    };

    // Step 1: Test database connection
    testResults.steps.push({ step: 1, name: 'Database Connection Test', status: 'testing' });
    try {
      const dbTest = await query('SELECT NOW() as current_time, current_database() as db_name', []);
      testResults.steps[0].status = 'success';
      testResults.steps[0].result = {
        connected: true,
        database: dbTest.rows[0].db_name,
        server_time: dbTest.rows[0].current_time,
      };
    } catch (error: any) {
      testResults.steps[0].status = 'failed';
      testResults.steps[0].error = error.message;
      res.status(500).json({ success: false, message: 'Database connection failed', data: testResults });
      return;
    }

    // Step 2: Check if notifications table exists
    testResults.steps.push({ step: 2, name: 'Check Notifications Table', status: 'testing' });
    try {
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        ) as table_exists
      `, []);
      testResults.steps[1].status = 'success';
      testResults.steps[1].result = {
        table_exists: tableCheck.rows[0].table_exists,
      };
      
      if (!tableCheck.rows[0].table_exists) {
        res.status(500).json({ 
          success: false, 
          message: 'Notifications table does not exist', 
          data: testResults 
        });
        return;
      }
    } catch (error: any) {
      testResults.steps[1].status = 'failed';
      testResults.steps[1].error = error.message;
    }

    // Step 3: Check RLS policies
    testResults.steps.push({ step: 3, name: 'Check RLS Policies', status: 'testing' });
    try {
      const rlsCheck = await query(`
        SELECT 
          schemaname,
          tablename,
          rowsecurity as rls_enabled
        FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'notifications'
      `, []);
      
      const policiesCheck = await query(`
        SELECT 
          policyname,
          permissive,
          roles,
          cmd,
          qual as using_expression,
          with_check as with_check_expression
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'notifications'
      `, []);
      
      testResults.steps[2].status = 'success';
      testResults.steps[2].result = {
        rls_enabled: rlsCheck.rows[0]?.rls_enabled || false,
        policies_count: policiesCheck.rows.length,
        policies: policiesCheck.rows,
      };
    } catch (error: any) {
      testResults.steps[2].status = 'failed';
      testResults.steps[2].error = error.message;
    }

    // Step 4: Get or create test users
    testResults.steps.push({ step: 4, name: 'Get Test Users', status: 'testing' });
    try {
      const usersQuery = await query(`
        SELECT id::text, role, email 
        FROM users 
        WHERE role IN ('student', 'university', 'admin') 
        AND is_active = true
        LIMIT 3
      `, []);
      
      testResults.steps[3].status = 'success';
      testResults.steps[3].result = {
        users_found: usersQuery.rows.length,
        users: usersQuery.rows.map(u => ({ id: u.id, role: u.role, email: u.email })),
      };

      if (usersQuery.rows.length === 0) {
        res.status(400).json({ 
          success: false, 
          message: 'No test users found in database. Please create users first.', 
          data: testResults 
        });
        return;
      }
    } catch (error: any) {
      testResults.steps[3].status = 'failed';
      testResults.steps[3].error = error.message;
    }

    // Step 5: Create test notification using publishNotification
    testResults.steps.push({ step: 5, name: 'Create Test Notification', status: 'testing' });
    try {
      const testUser = testResults.steps[3].result.users[0];
      const timestamp = Date.now();
      
      console.log('🧪 [TEST] Creating test notification for user:', testUser);
      
      const notifications = await publishNotification({
        recipients: [{ id: testUser.id, role: testUser.role }],
        notification_type: NOTIFICATION_TYPE.SYSTEM_BROADCAST,
        priority: NOTIFICATION_PRIORITY.LOW,
        title: '🧪 Test Notification',
        message: `This is a test notification created at ${new Date().toISOString()} to verify the notification system is working correctly.`,
        related_entity_type: 'test',
        related_entity_id: null,
        action_url: '/admin/notifications',
        event_key: `test:notification:${timestamp}`,
      });

      testResults.steps[4].status = 'success';
      testResults.steps[4].result = {
        notifications_created: notifications.length,
        notification_ids: notifications.map(n => n.id),
        sample_notification: notifications[0] || null,
      };
    } catch (error: any) {
      testResults.steps[4].status = 'failed';
      testResults.steps[4].error = error.message;
      testResults.steps[4].stack = error.stack;
    }

    // Step 6: Verify notification was saved
    testResults.steps.push({ step: 6, name: 'Verify Notification Saved', status: 'testing' });
    try {
      if (testResults.steps[4].status === 'success' && testResults.steps[4].result.notification_ids.length > 0) {
        const notifId = testResults.steps[4].result.notification_ids[0];
        const verifyQuery = await query('SELECT * FROM notifications WHERE id = $1', [notifId]);
        
        testResults.steps[5].status = 'success';
        testResults.steps[5].result = {
          found_in_db: verifyQuery.rows.length > 0,
          notification: verifyQuery.rows[0] || null,
        };
      } else {
        testResults.steps[5].status = 'skipped';
        testResults.steps[5].reason = 'No notification was created in previous step';
      }
    } catch (error: any) {
      testResults.steps[5].status = 'failed';
      testResults.steps[5].error = error.message;
    }

    // Count all notifications in DB
    testResults.steps.push({ step: 7, name: 'Count All Notifications', status: 'testing' });
    try {
      const countQuery = await query('SELECT COUNT(*) as total FROM notifications', []);
      testResults.steps[6].status = 'success';
      testResults.steps[6].result = {
        total_notifications_in_db: parseInt(countQuery.rows[0].total, 10),
      };
    } catch (error: any) {
      testResults.steps[6].status = 'failed';
      testResults.steps[6].error = error.message;
    }

    // Determine overall success
    const allPassed = testResults.steps.every((step: any) => 
      step.status === 'success' || step.status === 'skipped'
    );

    res.status(allPassed ? 200 : 500).json({
      success: allPassed,
      message: allPassed 
        ? 'All tests passed! Notification system is working correctly.'
        : 'Some tests failed. Check the steps for details.',
      data: testResults,
    });

  } catch (error: any) {
    console.error('❌ [TEST] Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Test endpoint encountered an error',
      error: error.message,
      stack: error.stack,
    });
  }
};
