/**
 * Changelogs Domain - Routes
 * 
 * Route definitions for changelogs endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as changelogsController from '../controllers/changelogs.controller';
import {
  changelogQuerySchema,
  uuidParamSchema,
  admissionIdParamSchema,
} from '../validators/changelogs.validators';
import { validateQuery, validateParams } from '@shared/middleware/validation';

const router: Router = Router();

/**
 * Changelogs Endpoints
 */

/**
 * @swagger
 * /api/v1/changelogs:
 *   get:
 *     summary: List changelogs
 *     tags: [Changelogs]
 *     description: Retrieve paginated list of changelogs with optional filters. Changelogs are immutable audit records.
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
 *         name: actor_type
 *         schema:
 *           type: string
 *           enum: [admin, university, system]
 *         description: Filter by actor type
 *       - in: query
 *         name: action_type
 *         schema:
 *           type: string
 *           enum: [created, updated, verified, rejected, status_changed]
 *         description: Filter by action type
 *       - in: query
 *         name: changed_by
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user who made the change
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date (ISO8601)
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date (ISO8601)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in diff_summary (case-insensitive)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, action_type, actor_type]
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
 *         description: Successfully retrieved changelogs
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
 *                         $ref: '#/components/schemas/Changelog'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/changelogs - List changelogs
router.get(
  '/',
  validateQuery(changelogQuerySchema),
  changelogsController.getChangelogs
);

/**
 * @swagger
 * /api/v1/changelogs/{id}:
 *   get:
 *     summary: Get changelog by ID
 *     tags: [Changelogs]
 *     description: Retrieve a specific changelog by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Changelog UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved changelog
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Changelog'
 *       404:
 *         description: Changelog not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/changelogs/:id - Get changelog by ID
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  changelogsController.getChangelog
);

/**
 * @swagger
 * /api/v1/changelogs/admission/{admissionId}:
 *   get:
 *     summary: Get changelogs for admission
 *     tags: [Changelogs]
 *     description: Retrieve all changelogs for a specific admission, ordered chronologically.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: admissionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Admission UUID
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
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, action_type, actor_type]
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
 *         description: Successfully retrieved changelogs
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
 *                         $ref: '#/components/schemas/Changelog'
 */
// GET /api/v1/changelogs/admission/:admissionId - Get changelogs for admission
router.get(
  '/admission/:admissionId',
  validateParams(admissionIdParamSchema),
  changelogsController.getChangelogsByAdmission
);

export default router;
