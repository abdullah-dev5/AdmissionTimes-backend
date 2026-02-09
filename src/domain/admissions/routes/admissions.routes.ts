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
  createAdmissionSchema,
  updateAdmissionSchema,
  verifyAdmissionSchema,
  rejectAdmissionSchema,
  submitAdmissionSchema,
  disputeAdmissionSchema,
  admissionQuerySchema,
  uuidParamSchema,
} from '../validators/admissions.validators';
import { validateBody, validateQuery, validateParams } from '@shared/middleware/validation';

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
 *           enum: [draft, pending, verified, rejected, disputed]
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
 * University Endpoints
 * (Same routes as public, but with different access control in service layer)
 */

/**
 * @swagger
 * /api/v1/admissions:
 *   post:
 *     summary: Create admission
 *     tags: [Admissions]
 *     description: Create a new admission record. Only universities can create admissions. New admissions are created with status 'draft'.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 example: 'Computer Science Master Program'
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *                 example: 'A comprehensive master program in computer science'
 *               program_type:
 *                 type: string
 *                 example: 'graduate'
 *               degree_level:
 *                 type: string
 *                 example: 'master'
 *               field_of_study:
 *                 type: string
 *                 example: 'Computer Science'
 *               duration:
 *                 type: string
 *                 example: '2 years'
 *               tuition_fee:
 *                 type: number
 *                 minimum: 0
 *                 example: 25000
 *               currency:
 *                 type: string
 *                 length: 3
 *                 example: 'USD'
 *               application_fee:
 *                 type: number
 *                 minimum: 0
 *                 example: 100
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               start_date:
 *                 type: string
 *                 format: date
 *               location:
 *                 type: string
 *                 example: 'New York, USA'
 *               campus:
 *                 type: string
 *                 example: 'Main Campus'
 *               delivery_mode:
 *                 type: string
 *                 enum: [on-campus, online, hybrid]
 *                 example: 'on-campus'
 *               requirements:
 *                 type: object
 *     responses:
 *       201:
 *         description: Admission created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Admission'
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
// POST /api/v1/admissions - Create admission (university)
router.post(
  '/',
  validateBody(createAdmissionSchema),
  admissionsController.createAdmission
);

/**
 * @swagger
 * /api/v1/admissions/{id}:
 *   put:
 *     summary: Update admission
 *     tags: [Admissions]
 *     description: Update an existing admission. Only the university that created it can update (unless admin). All fields are optional for partial updates.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 5000
 *               program_type:
 *                 type: string
 *               degree_level:
 *                 type: string
 *               field_of_study:
 *                 type: string
 *               duration:
 *                 type: string
 *               tuition_fee:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *                 length: 3
 *               application_fee:
 *                 type: number
 *                 minimum: 0
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               start_date:
 *                 type: string
 *                 format: date
 *               location:
 *                 type: string
 *               campus:
 *                 type: string
 *               delivery_mode:
 *                 type: string
 *                 enum: [on-campus, online, hybrid]
 *               requirements:
 *                 type: object
 *     responses:
 *       200:
 *         description: Admission updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Admission'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Admission not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PUT /api/v1/admissions/:id - Update admission (university)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAdmissionSchema),
  admissionsController.updateAdmission
);

// DELETE /api/v1/admissions/:id - Delete admission (soft delete)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  admissionsController.deleteAdmission
);

/**
 * @swagger
 * /api/v1/admissions/{id}/submit:
 *   patch:
 *     summary: Submit admission for verification
 *     tags: [Admissions]
 *     description: Submit a draft admission for verification. Changes status from 'draft' to 'pending'. Only universities can submit their own admissions.
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               submitted_by:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Admission submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Admission'
 *       400:
 *         description: Invalid status transition or validation error
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
 */
// PATCH /api/v1/admissions/:id/submit - Submit admission (university - draft to pending)
router.patch(
  '/:id/submit',
  validateParams(uuidParamSchema),
  validateBody(submitAdmissionSchema),
  admissionsController.submitAdmission
);

/**
 * @swagger
 * /api/v1/admissions/{id}/dispute:
 *   patch:
 *     summary: Dispute rejected admission
 *     tags: [Admissions]
 *     description: Dispute a rejected admission. Changes status from 'rejected' to 'disputed'. Only universities can dispute their own rejected admissions.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - dispute_reason
 *             properties:
 *               dispute_reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *                 example: 'I believe the rejection was incorrect because...'
 *               disputed_by:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Admission disputed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Admission'
 *       400:
 *         description: Invalid status transition or validation error
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
 */
// PATCH /api/v1/admissions/:id/dispute - Dispute rejected admission (university - rejected to disputed)
router.patch(
  '/:id/dispute',
  validateParams(uuidParamSchema),
  validateBody(disputeAdmissionSchema),
  admissionsController.disputeAdmission
);

/**
 * Admin Endpoints
 */

/**
 * @swagger
 * /api/v1/admissions/{id}/verify:
 *   patch:
 *     summary: Verify admission
 *     tags: [Admissions]
 *     description: Verify an admission. Changes status from 'pending' or 'disputed' to 'verified'. Only admins can verify admissions.
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verified_by:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Admission verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Admission'
 *       400:
 *         description: Invalid status transition
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin access required
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
 */
// PATCH /api/v1/admissions/:id/verify - Verify admission (admin)
router.patch(
  '/:id/verify',
  validateParams(uuidParamSchema),
  validateBody(verifyAdmissionSchema),
  admissionsController.verifyAdmission
);

/**
 * @swagger
 * /api/v1/admissions/{id}/reject:
 *   patch:
 *     summary: Reject admission
 *     tags: [Admissions]
 *     description: Reject an admission. Changes status from 'pending' or 'disputed' to 'rejected'. Only admins can reject admissions.
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejection_reason
 *             properties:
 *               rejection_reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 1000
 *                 example: 'The admission does not meet our quality standards because...'
 *               rejected_by:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Admission rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Admission'
 *       400:
 *         description: Invalid status transition or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin access required
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
 */
// PATCH /api/v1/admissions/:id/reject - Reject admission (admin)
router.patch(
  '/:id/reject',
  validateParams(uuidParamSchema),
  validateBody(rejectAdmissionSchema),
  admissionsController.rejectAdmission
);

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
  upload.single('file'),
  admissionsController.parsePDF
);

export default router;
