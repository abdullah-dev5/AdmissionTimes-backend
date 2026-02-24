/**
 * Deadlines Domain - Routes
 * 
 * Route definitions for deadlines endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as deadlinesController from '../controllers/deadlines.controller';
import {
  deadlineQuerySchema,
  uuidParamSchema,
  createDeadlineSchema,
  updateDeadlineSchema,
} from '../validators/deadlines.validators';
import { validateQuery, validateParams, validateBody } from '@shared/middleware/validation';

const router: Router = Router();

/**
 * Public Endpoints
 */

/**
 * @swagger
 * /api/v1/deadlines:
 *   get:
 *     summary: List deadlines
 *     tags: [Deadlines]
 *     description: Retrieve paginated list of deadlines with optional filters. Includes calculated metadata (days remaining, urgency level).
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
 *         name: admission_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by admission ID
 *       - in: query
 *         name: deadline_type
 *         schema:
 *           type: string
 *           enum: [application, decision, enrollment, document, interview, document_submission, payment, orientation, other]
 *         description: Filter by deadline type
 *       - in: query
 *         name: is_overdue
 *         schema:
 *           type: boolean
 *         description: Filter by overdue status
 *       - in: query
 *         name: is_upcoming
 *         schema:
 *           type: boolean
 *         description: Filter for upcoming deadlines only
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter deadlines from this date
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter deadlines until this date
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [deadline_date, created_at, updated_at, deadline_type]
 *           default: deadline_date
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved deadlines
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
 *                         $ref: '#/components/schemas/DeadlineWithMetadata'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/deadlines - List deadlines (paginated, filtered)
router.get(
  '/',
  validateQuery(deadlineQuerySchema),
  deadlinesController.getDeadlines
);

/**
 * @swagger
 * /api/v1/deadlines:
 *   post:
 *     summary: Create a new deadline
 *     tags: [Deadlines]
 *     description: Create a new deadline for an admission
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admission_id
 *               - deadline_type
 *               - deadline_date
 *             properties:
 *               admission_id:
 *                 type: string
 *                 format: uuid
 *                 description: Admission ID
 *               deadline_type:
 *                 type: string
 *                 enum: [application, decision, enrollment, document, interview, document_submission, payment, orientation, other]
 *                 description: Deadline type
 *               deadline_date:
 *                 type: string
 *                 format: date-time
 *                 description: Deadline date (must be in the future)
 *               timezone:
 *                 type: string
 *                 default: UTC
 *                 description: Timezone
 *               is_flexible:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the deadline is flexible
 *     responses:
 *       201:
 *         description: Deadline created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DeadlineWithMetadata'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Admission not found
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
// POST /api/v1/deadlines - Create deadline
router.post(
  '/',
  validateBody(createDeadlineSchema),
  deadlinesController.createDeadline
);

/**
 * @swagger
 * /api/v1/deadlines/upcoming:
 *   get:
 *     summary: Get upcoming deadlines
 *     tags: [Deadlines]
 *     description: Retrieve a list of upcoming deadlines (deadlines in the future), ordered by nearest deadline first
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of deadlines to return
 *     responses:
 *       200:
 *         description: Successfully retrieved upcoming deadlines
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
 *                         $ref: '#/components/schemas/DeadlineWithMetadata'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/deadlines/upcoming - Get upcoming deadlines
router.get(
  '/upcoming',
  deadlinesController.getUpcomingDeadlines
);

/**
 * @swagger
 * /api/v1/deadlines/urgent:
 *   get:
 *     summary: Get urgent deadlines
 *     tags: [Deadlines]
 *     description: Retrieve urgent deadlines (deadlines within next 3 days), ordered by nearest deadline first
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved urgent deadlines
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
 *                         $ref: '#/components/schemas/DeadlineWithMetadata'
 */
// GET /api/v1/deadlines/urgent - Get urgent deadlines (within 3 days)
router.get(
  '/urgent',
  deadlinesController.getUrgentDeadlines
);

// POST /api/v1/deadlines/notify-upcoming - Trigger deadline reminder notifications (admin only)
router.post(
  '/notify-upcoming',
  deadlinesController.triggerDeadlineReminders
);

/**
 * @swagger
 * /api/v1/deadlines/{id}:
 *   get:
 *     summary: Get deadline by ID
 *     tags: [Deadlines]
 *     description: Retrieve a specific deadline by its ID with calculated metadata (days remaining, urgency level, overdue status)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Deadline UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved deadline
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DeadlineWithMetadata'
 *       404:
 *         description: Deadline not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/deadlines/:id - Get deadline detail
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  deadlinesController.getDeadline
);

/**
 * @swagger
 * /api/v1/deadlines/{id}:
 *   put:
 *     summary: Update a deadline
 *     tags: [Deadlines]
 *     description: Update an existing deadline. Deadline date must be in the future.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Deadline UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deadline_type:
 *                 type: string
 *                 enum: [application, document_submission, payment, other]
 *                 description: Deadline type
 *               deadline_date:
 *                 type: string
 *                 format: date-time
 *                 description: Deadline date (must be in the future)
 *               timezone:
 *                 type: string
 *                 description: Timezone
 *               is_flexible:
 *                 type: boolean
 *                 description: Whether the deadline is flexible
 *               reminder_sent:
 *                 type: boolean
 *                 description: Whether reminder has been sent
 *     responses:
 *       200:
 *         description: Deadline updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DeadlineWithMetadata'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Deadline not found
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
// PUT /api/v1/deadlines/:id - Update deadline
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateDeadlineSchema),
  deadlinesController.updateDeadline
);

/**
 * @swagger
 * /api/v1/deadlines/{id}:
 *   delete:
 *     summary: Delete a deadline
 *     tags: [Deadlines]
 *     description: Delete a deadline by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Deadline UUID
 *     responses:
 *       200:
 *         description: Deadline deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Deadline not found
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
// DELETE /api/v1/deadlines/:id - Delete deadline
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  deadlinesController.deleteDeadline
);

/**
 * @swagger
 * /api/v1/users/me/upcoming-deadlines:
 *   get:
 *     summary: Get user's upcoming deadlines with details
 *     tags: [Deadlines, Users]
 *     description: Retrieve paginated list of upcoming deadlines for the current user, including admission and university information
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 7
 *         description: Number of days ahead to look for deadlines
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: alert_enabled
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Only include deadlines with alerts enabled
 *     responses:
 *       200:
 *         description: Successfully retrieved user's upcoming deadlines
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       admission_id:
 *                         type: string
 *                         format: uuid
 *                       admission_title:
 *                         type: string
 *                       deadline_date:
 *                         type: string
 *                         format: date-time
 *                       days_remaining:
 *                         type: integer
 *                       urgency_level:
 *                         type: string
 *                         enum: [low, medium, high, critical, expired]
 *                       university_name:
 *                         type: string
 *                       university_logo:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/users/me/upcoming-deadlines - Get user's upcoming deadlines
router.get(
  '/me/upcoming-deadlines',
  deadlinesController.getUserUpcomingDeadlines
);

export default router;
