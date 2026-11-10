/**
 * Admissions Domain - Routes
 * 
 * Route definitions for admissions endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as admissionsController from '../controllers/admissions.controller';
import { upload } from '../middleware/upload';
import {
  admissionQuerySchema,
  uuidParamSchema,
} from '../validators/admissions.validators';
import { validateQuery, validateParams } from '@shared/middleware/validation';
import { requireRole } from '@shared/middleware/jwtAuth';

const managers = requireRole(['university', 'admin']);

const router: Router = Router();

/**
 * Public/Student Endpoints
 */

/**
 * @swagger
 * /api/v1/admissions:
 *   get:
 *     summary: List admissions
 *     tags: [Admissions]
 *     description: Retrieve paginated list of admissions with optional filters. Public users see only verified admissions.
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term (searches title, description, field_of_study, location)
 *       - in: query
 *         name: program_type
 *         schema:
 *           type: string
 *         description: Filter by program type
 *       - in: query
 *         name: degree_level
 *         schema:
 *           type: string
 *         description: Filter by degree level
 *       - in: query
 *         name: field_of_study
 *         schema:
 *           type: string
 *         description: Filter by field of study
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: delivery_mode
 *         schema:
 *           type: string
 *           enum: [on-campus, online, hybrid]
 *         description: Filter by delivery mode
 *       - in: query
 *         name: verification_status
 *         schema:
 *           type: string
 *           enum: [draft, pending, verified, rejected]
 *         description: Filter by verification status (admin/university only)
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, deadline, title, tuition_fee, verified_at]
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
 *         description: Successfully retrieved admissions
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
 *                         $ref: '#/components/schemas/Admission'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/admissions - List admissions (public, only verified)
router.get(
  '/',
  validateQuery(admissionQuerySchema),
  admissionsController.getAdmissions
);

/**
 * @swagger
 * /api/v1/admissions/{id}:
 *   get:
 *     summary: Get admission by ID
 *     tags: [Admissions]
 *     description: Retrieve a specific admission by its ID. Public users can only access verified admissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Admission UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved admission
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Admission'
 *       404:
 *         description: Admission not found or access denied
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
// GET /api/v1/admissions/:id - Get admission detail (public, only verified)
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  admissionsController.getAdmission
);

/**
 * Writes are not served here: universities use /university/admissions and
 * admins moderate through /admin/admissions. This router is read-only plus
 * PDF parsing for admission forms.
 */

/**
 * Changelog Endpoints
 */

/**
 * @swagger
 * /api/v1/admissions/{id}/changelogs:
 *   get:
 *     summary: Get admission changelogs
 *     tags: [Admissions]
 *     description: Retrieve paginated changelog history for a specific admission
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
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
 *       404:
 *         description: Admission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/admissions/:id/changelogs - Get admission changelogs
router.get(
  '/:id/changelogs',
  managers,
  validateParams(uuidParamSchema),
  admissionsController.getChangelogs
);

/**
 * @swagger
 * /api/v1/admissions/{id}/deadlines:
 *   get:
 *     summary: Get admission deadlines
 *     tags: [Admissions]
 *     description: Retrieve all deadlines associated with a specific admission
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Admission UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved deadlines
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
 *       404:
 *         description: Admission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/admissions/:id/deadlines - Get admission deadlines
router.get(
  '/:id/deadlines',
  validateParams(uuidParamSchema),
  admissionsController.getAdmissionDeadlines
);

/**
 * @swagger
 * /api/v1/admissions/parse-pdf:
 *   post:
 *     summary: Parse PDF and extract admission data
 *     tags: [Admissions]
 *     description: Upload a PDF file and extract structured admission data from it
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to parse (max 10MB)
 *               university_id:
 *                 type: string
 *                 format: uuid
 *                 description: University ID (optional)
 *     responses:
 *       200:
 *         description: PDF parsed successfully
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
 *                         title:
 *                           type: string
 *                         degree_level:
 *                           type: string
 *                         deadline:
 *                           type: string
 *                           format: date-time
 *                         application_fee:
 *                           type: number
 *                         location:
 *                           type: string
 *                         description:
 *                           type: string
 *                         confidence:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                         extracted_fields:
 *                           type: array
 *                           items:
 *                             type: string
 *       400:
 *         description: Validation error or invalid PDF
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
// POST /api/v1/admissions/parse-pdf - Parse PDF and extract data
router.post(
  '/parse-pdf',
  managers,
  upload.single('file'),
  admissionsController.parsePDF
);

export default router;
