/**
 * Analytics Domain - Routes
 * 
 * Route definitions for analytics endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import {
  createAnalyticsEventSchema,
} from '../validators/analytics.validators';
import { validateBody } from '@shared/middleware/validation';

const router: Router = Router();

/**
 * Analytics Endpoints
 */

/**
 * @swagger
 * /api/v1/analytics/events:
 *   post:
 *     summary: Track analytics event
 *     tags: [Analytics]
 *     description: Track a system analytics event. Events are append-only and used for aggregation.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_type
 *             properties:
 *               event_type:
 *                 type: string
 *                 enum: [admission_viewed, admission_created, verification_completed, verification_rejected, deadline_approaching, search_performed, comparison_made]
 *                 description: Type of event
 *               entity_type:
 *                 type: string
 *                 maxLength: 100
 *                 description: Type of entity (e.g., "admission")
 *               entity_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the entity
 *               user_type:
 *                 type: string
 *                 enum: [student, university, admin]
 *                 description: Type of user who triggered the event
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user who triggered the event
 *               metadata:
 *                 type: object
 *                 description: Minimal metadata for event context
 *     responses:
 *       201:
 *         description: Event tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// POST /api/v1/analytics/events - Track event
router.post(
  '/events',
  validateBody(createAnalyticsEventSchema),
  analyticsController.trackEvent
);

/**
 * @swagger
 * /api/v1/analytics/stats:
 *   get:
 *     summary: Get general statistics
 *     tags: [Analytics]
 *     description: Retrieve general system statistics including total events, admissions, users, and event counts by type.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved statistics
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
 *                         total_events:
 *                           type: integer
 *                         total_admissions:
 *                           type: integer
 *                         total_users:
 *                           type: integer
 *                         events_by_type:
 *                           type: object
 *                         events_today:
 *                           type: integer
 *                         events_this_week:
 *                           type: integer
 *                         events_this_month:
 *                           type: integer
 */
// GET /api/v1/analytics/stats - Get general statistics
router.get(
  '/stats',
  analyticsController.getGeneralStatistics
);

/**
 * @swagger
 * /api/v1/analytics/admissions:
 *   get:
 *     summary: Get admission statistics
 *     tags: [Analytics]
 *     description: Retrieve admission-related statistics including counts by status, creation trends, and verification rates.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved admission statistics
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
 *                         total_admissions:
 *                           type: integer
 *                         admissions_by_status:
 *                           type: object
 *                         admissions_created_today:
 *                           type: integer
 *                         admissions_created_this_week:
 *                           type: integer
 *                         admissions_created_this_month:
 *                           type: integer
 *                         verification_rate:
 *                           type: number
 *                         rejection_rate:
 *                           type: number
 */
// GET /api/v1/analytics/admissions - Get admission statistics
router.get(
  '/admissions',
  analyticsController.getAdmissionStatistics
);

/**
 * @swagger
 * /api/v1/analytics/users:
 *   get:
 *     summary: Get user statistics
 *     tags: [Analytics]
 *     description: Retrieve user-related statistics including counts by role, active/suspended users, and creation trends.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user statistics
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
 *                         total_users:
 *                           type: integer
 *                         users_by_role:
 *                           type: object
 *                         active_users:
 *                           type: integer
 *                         suspended_users:
 *                           type: integer
 *                         users_created_today:
 *                           type: integer
 *                         users_created_this_week:
 *                           type: integer
 *                         users_created_this_month:
 *                           type: integer
 */
// GET /api/v1/analytics/users - Get user statistics
router.get(
  '/users',
  analyticsController.getUserStatistics
);

/**
 * @swagger
 * /api/v1/analytics/activity:
 *   get:
 *     summary: Get aggregated activity feed
 *     tags: [Analytics]
 *     description: Retrieve aggregated activity feed showing recent events grouped by type and entity.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of items to return
 *     responses:
 *       200:
 *         description: Successfully retrieved activity feed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           event_type:
 *                             type: string
 *                           entity_type:
 *                             type: string
 *                           entity_id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           last_occurred_at:
 *                             type: string
 *                             format: date-time
 */
// GET /api/v1/analytics/activity - Get aggregated activity feed
router.get(
  '/activity',
  analyticsController.getActivityFeed
);

export default router;
