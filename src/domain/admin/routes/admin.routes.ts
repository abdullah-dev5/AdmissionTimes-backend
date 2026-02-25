/**
 * Admin Domain - Routes
 * 
 * Route definitions for admin endpoints.
 * Maps HTTP methods and paths to controller functions.
 * 
 * All routes require admin authorization via adminOnly middleware.
 */

import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { adminOnly } from '../middleware/adminOnly';
import {
  verifyAdmissionSchema,
  revisionRequiredSchema,
  bulkVerifySchema,
  adminFilterSchema,
  uuidParamSchema,
} from '../validators/admin.validators';
import { validateBody, validateQuery, validateParams } from '@shared/middleware/validation';

const router: Router = Router();

/**
 * Apply admin authorization to all routes
 */
router.use(adminOnly);

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard
 *     tags: [Admin]
 *     description: |
 *       Get dashboard overview with statistics and recent activity. Admin only.
 *       Returns:
 *       - Total statistics (total, pending, verified, rejected, disputed)
 *       - Recent admin actions (last 10)
 *       - Pending admissions list (up to 5)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved admin dashboard
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
 *                         stats:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                             pending:
 *                               type: number
 *                             verified:
 *                               type: number
 *                             rejected:
 *                               type: number
 *                             disputed:
 *                               type: number
 *                         recent_actions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/AdminAuditLog'
 *                         pending_admissions:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/AdminAdmission'
 *       403:
 *         description: Admin access required
 */
// GET /api/v1/admin/dashboard - Get admin dashboard
// NOTE: Commented out to use the comprehensive dashboard route in dashboard.routes.ts
// which includes university name joins and proper CTE formatting
// router.get(
//   '/dashboard',
//   adminController.getAdminDashboard
// );

/**
 * @swagger
 * /api/v1/admin/admissions/pending:
 *   get:
 *     summary: Get pending admissions
 *     tags: [Admin]
 *     description: Retrieve paginated list of pending admissions. Admin only.
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, verified, rejected, disputed]
 *         description: Filter by status
 *       - in: query
 *         name: university_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by university
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, verified_at, status]
 *           default: created_at
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved pending admissions
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
 *                         $ref: '#/components/schemas/AdminAdmission'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
// GET /api/v1/admin/admissions - Get all admissions with optional status filter
router.get(
  '/admissions',
  validateQuery(adminFilterSchema),
  adminController.getAllAdmissions
);

/**
 * @swagger
 * /api/v1/admin/admissions/pending:
 *   get:
 *     summary: Get pending admissions
 *     tags: [Admin]
 *     description: Retrieve admissions pending verification. Admin only.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           default: created_at
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Pending admissions retrieved
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
 *                         $ref: '#/components/schemas/AdminAdmission'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
// GET /api/v1/admin/admissions/pending - Get pending admissions
router.get(
  '/admissions/pending',
  validateQuery(adminFilterSchema),
  adminController.getPendingAdmissions
);

/**
 * @swagger
 * /api/v1/admin/admissions/bulk-verify:
 *   post:
 *     summary: Bulk verify admissions
 *     tags: [Admin]
 *     description: |
 *       Verify or reject multiple admissions in one request. Admin only.
 *       Processes all admissions and returns success count and failures.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admission_ids
 *               - verification_status
 *             properties:
 *               admission_ids:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of admission UUIDs to verify
 *               verification_status:
 *                 type: string
 *                 enum: [verified, rejected, disputed]
 *                 description: Status to apply to all admissions
 *               rejection_reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Required when status is 'rejected'
 *               admin_notes:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Bulk verification completed
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
 *                         successful:
 *                           type: number
 *                           description: Number of successfully verified admissions
 *                         failed:
 *                           type: number
 *                           description: Number of failed verifications
 *                         errors:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               admission_id:
 *                                 type: string
 *                               error:
 *                                 type: string
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
// POST /api/v1/admin/admissions/bulk-verify - Bulk verify admissions (before :id route!)
router.post(
  '/admissions/bulk-verify',
  validateBody(bulkVerifySchema),
  adminController.bulkVerifyAdmissions
);

/**
 * @swagger
 * /api/v1/admin/admissions/{id}/verify:
 *   post:
 *     summary: Verify an admission
 *     tags: [Admin]
 *     description: |
 *       Verify or reject a single admission. Admin only.
 *       
 *       Valid status transitions:
 *       - draft → [pending, rejected]
 *       - pending → [verified, rejected, disputed]
 *       - verified → [disputed]
 *       - rejected → [pending, disputed]
 *       - disputed → [verified, rejected, pending]
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
 *               - verification_status
 *             properties:
 *               verification_status:
 *                 type: string
 *                 enum: [verified, rejected, disputed]
 *                 description: New verification status
 *               rejection_reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 description: Required when status is 'rejected'
 *               admin_notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional admin notes
 *               verification_comments:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional verification comments
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
 *                       $ref: '#/components/schemas/AdminAdmission'
 *       400:
 *         description: Invalid status transition or validation error
 *       404:
 *         description: Admission not found
 *       403:
 *         description: Admin access required
 */
// POST /api/v1/admin/admissions/:id/verify - Verify single admission
router.post(
  '/admissions/:id/verify',
  validateParams(uuidParamSchema),
  validateBody(verifyAdmissionSchema),
  adminController.verifyAdmission
);

// POST /api/v1/admin/admissions/:id/revision-required - Request revision from university
router.post(
  '/admissions/:id/revision-required',
  validateParams(uuidParamSchema),
  validateBody(revisionRequiredSchema),
  adminController.requestRevision
);

/**
 * @swagger
 * /api/v1/admin/admissions/{id}:
 *   get:
 *     summary: Get admission details
 *     tags: [Admin]
 *     description: Retrieve detailed information about a specific admission. Admin only.
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
 *         description: Successfully retrieved admission details
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AdminAdmission'
 *       404:
 *         description: Admission not found
 *       403:
 *         description: Admin access required
 */
// GET /api/v1/admin/admissions/:id - Get admission details (after specific routes!)
router.get(
  '/admissions/:id',
  validateParams(uuidParamSchema),
  adminController.getAdmissionDetails
);
export default router;
