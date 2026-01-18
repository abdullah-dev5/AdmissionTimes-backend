/**
 * User Activity Domain - Routes
 * 
 * Route definitions for user activity endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as userActivityController from '../controllers/user-activity.controller';
import {
  userActivityQuerySchema,
  uuidParamSchema,
} from '../validators/user-activity.validators';
import { validateQuery, validateParams } from '@shared/middleware/validation';

const router: Router = Router();

/**
 * Public/User Endpoints
 */

/**
 * @swagger
 * /api/v1/activity:
 *   get:
 *     summary: List user activities
 *     tags: [Activity]
 *     description: Retrieve paginated list of user activities with optional filters. Users can only see their own activities.
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
 *         name: activity_type
 *         schema:
 *           type: string
 *           enum: [viewed, searched, compared, watchlisted]
 *         description: Filter by activity type
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *         description: Filter by entity type (e.g., "admission")
 *       - in: query
 *         name: entity_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by entity ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, activity_type, entity_type]
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
 *         description: Successfully retrieved activities
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
 *                         $ref: '#/components/schemas/UserActivity'
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
// GET /api/v1/activity - List activities (paginated, filtered)
router.get(
  '/',
  validateQuery(userActivityQuerySchema),
  userActivityController.getActivities
);

/**
 * @swagger
 * /api/v1/activity/{id}:
 *   get:
 *     summary: Get activity by ID
 *     tags: [Activity]
 *     description: Retrieve a specific user activity by its ID. Users can only access their own activities.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Activity UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved activity
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserActivity'
 *       404:
 *         description: Activity not found or access denied
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
// GET /api/v1/activity/:id - Get activity detail
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  userActivityController.getActivity
);

export default router;
