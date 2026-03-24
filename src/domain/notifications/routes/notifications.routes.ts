/**
 * Notifications Domain - Routes
 * 
 * Route definitions for notifications endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as notificationsController from '../controllers/notifications.controller';
import { sendBroadcast } from '../controllers/notifications.broadcast.controller';
import { testNotificationCreation } from '../controllers/notifications.test.controller';
import {
  notificationQuerySchema,
  uuidParamSchema,
  markReadSchema,
  createNotificationSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from '../validators/notifications.validators';
import { validateBody, validateQuery, validateParams } from '@shared/middleware/validation';
import { requireRole } from '@shared/middleware/jwtAuth';

const router: Router = Router();

/**
 * Public/User Endpoints
 */

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Notifications]
 *     description: Retrieve paginated list of notifications for the current user with optional filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: notification_type
 *         schema:
 *           type: string
 *           enum: [admission_submitted, admission_resubmitted, admission_verified, admission_rejected, admission_revision_required, admission_updated_saved, deadline_near, system_broadcast, system_error]
 *         description: Filter by notification type
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by notification priority
 *       - in: query
 *         name: is_read
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, read_at, priority, notification_type]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved notifications
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/notifications - List notifications (paginated, filtered)
router.get(
  '/',
  validateQuery(notificationQuerySchema),
  notificationsController.getNotifications
);

/**
 * @swagger
 * /api/v1/notifications:
 *   post:
 *     summary: Create a new notification
 *     tags: [Notifications]
 *     description: Create a new notification (typically used by system, but available for manual creation)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role_type
 *               - notification_type
 *               - title
 *               - message
 *             properties:
 *               recipient_id:
 *                 type: string
 *                 format: uuid
 *                 description: Recipient ID
 *               role_type:
 *                 type: string
 *                 enum: [student, university, admin]
 *                 description: Recipient role type
 *               notification_type:
 *                 type: string
 *                 enum: [admission_submitted, admission_resubmitted, admission_verified, admission_rejected, admission_revision_required, admission_updated_saved, deadline_near, system_broadcast, system_error]
 *                 description: Notification type
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Notification priority
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Notification title
 *               message:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Notification message
 *               related_entity_type:
 *                 type: string
 *                 description: Related entity type (e.g., "admission")
 *               related_entity_id:
 *                 type: string
 *                 format: uuid
 *                 description: Related entity ID
 *               action_url:
 *                 type: string
 *                 format: uri
 *                 description: Action URL (optional)
 *               event_key:
 *                 type: string
 *                 description: Idempotency event key
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/v1/notifications - Create notification
router.post(
  '/',
  validateBody(createNotificationSchema),
  notificationsController.createNotification
);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     tags: [Notifications]
 *     description: Get the count of unread notifications for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved unread count
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 5
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/notifications/unread-count - Get unread count
router.get(
  '/unread-count',
  notificationsController.getUnreadCount
);

// POST /api/v1/notifications/push-token - Register Expo push token for current user
router.post(
  '/push-token',
  validateBody(registerPushTokenSchema),
  notificationsController.registerPushToken
);

// DELETE /api/v1/notifications/push-token - Unregister Expo push token for current user
router.delete(
  '/push-token',
  validateBody(unregisterPushTokenSchema),
  notificationsController.unregisterPushToken
);

// GET /api/v1/notifications/admin/email-logs - List email delivery logs (admin only)
router.get(
  '/admin/email-logs',
  requireRole(['admin']),
  notificationsController.getEmailDeliveryLogs
);

// POST /api/v1/notifications/admin/email-logs/:id/replay - Replay email by log id (admin only)
router.post(
  '/admin/email-logs/:id/replay',
  requireRole(['admin']),
  validateParams(uuidParamSchema),
  notificationsController.replayEmailFromLog
);

// POST /api/v1/notifications/admin/notifications/:id/replay-email - Replay email by notification id (admin only)
router.post(
  '/admin/notifications/:id/replay-email',
  requireRole(['admin']),
  validateParams(uuidParamSchema),
  notificationsController.replayEmailByNotificationId
);

// DELETE /api/v1/notifications/admin/manual-test-cleanup - Cleanup manual reminder test notifications (admin only)
router.delete(
  '/admin/manual-test-cleanup',
  requireRole(['admin']),
  notificationsController.cleanupManualReminderTestNotifications
);

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   get:
 *     summary: Get notification by ID
 *     tags: [Notifications]
 *     description: Retrieve a specific notification by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved notification
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/notifications/:id - Get notification detail
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  notificationsController.getNotification
);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     description: Mark a specific notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification UUID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               read_at:
 *                 type: string
 *                 format: date-time
 *                 description: Optional read timestamp (defaults to now)
 *     responses:
 *       200:
 *         description: Successfully marked notification as read
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Notification'
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH /api/v1/notifications/:id/read - Mark notification as read
router.patch(
  '/:id/read',
  validateParams(uuidParamSchema),
  validateBody(markReadSchema),
  notificationsController.markNotificationAsRead
);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     description: Mark all unread notifications for the current user as read
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               read_at:
 *                 type: string
 *                 format: date-time
 *                 description: Optional read timestamp (defaults to now)
 *     responses:
 *       200:
 *         description: Successfully marked all notifications as read
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 5
 *                           description: Number of notifications marked as read
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH /api/v1/notifications/read-all - Mark all notifications as read
router.patch(
  '/read-all',
  validateBody(markReadSchema),
  notificationsController.markAllNotificationsAsRead
);

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Notifications]
 *     description: Delete a notification by ID. Users can only delete their own notifications.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification UUID
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Notification not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// DELETE /api/v1/notifications/:id - Delete notification
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  notificationsController.deleteNotification
);

/**
 * @swagger
 * /api/v1/notifications/broadcast:
 *   post:
 *     summary: Send broadcast notification
 *     tags: [Notifications]
 *     description: Send a broadcast notification to multiple users (admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - target_type
 *               - title
 *               - message
 *             properties:
 *               target_type:
 *                 type: string
 *                 enum: [all, role, maintenance, emergency]
 *                 description: Broadcast target type
 *               target_roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [student, university, admin, maintenance]
 *                 description: Target roles (required if target_type is 'role')
 *               title:
 *                 type: string
 *                 description: Notification title
 *               message:
 *                 type: string
 *                 description: Notification message
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 description: Notification priority
 *               action_url:
 *                 type: string
 *                 description: Optional URL for action button
 *     responses:
 *       200:
 *         description: Broadcast sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     recipients_count:
 *                       type: integer
 *                     success:
 *                       type: boolean
 *                     created_count:
 *                       type: integer
 *       403:
 *         description: Forbidden - admin only
 *       401:
 *         description: Unauthorized
 */
// POST /api/v1/notifications/broadcast - Send broadcast notification (admin only)
router.post('/broadcast', sendBroadcast);

/**
 * @swagger
 * /api/v1/notifications/test:
 *   post:
 *     summary: Test notification creation (debug endpoint)
 *     tags: [Notifications]
 *     description: Debug endpoint to test notification creation and database connectivity
 *     responses:
 *       200:
 *         description: Test completed successfully
 *       500:
 *         description: Test failed
 */
// POST /api/v1/notifications/test - Test notification creation (debug)
router.post('/test', testNotificationCreation);

export default router;
