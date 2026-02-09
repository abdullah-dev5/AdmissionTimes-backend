/**
 * Admin Admissions Routes
 * 
 * Alias routes for frontend compatibility.
 * These map /api/v1/admin/admissions to the core admissions controllers.
 */

import { Router } from 'express';
import * as admissionsController from '../controllers/admissions.controller';
import {
  admissionQuerySchema,
  uuidParamSchema,
  adminVerifyAdmissionSchema,
} from '../validators/admissions.validators';
import { validateQuery, validateParams, validateBody } from '@shared/middleware/validation';

const router: Router = Router();

// GET /api/v1/admin/admissions - List all admissions (admin view)
router.get(
  '/',
  validateQuery(admissionQuerySchema),
  admissionsController.getAdmissions
);

// GET /api/v1/admin/admissions/:id - Get admission details
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  admissionsController.getAdmission
);

// POST /api/v1/admin/admissions/:id/verify - Verify or reject admission (admin action)
router.post(
  '/:id/verify',
  validateParams(uuidParamSchema),
  validateBody(adminVerifyAdmissionSchema),
  admissionsController.adminVerifyAdmission
);

// DELETE /api/v1/admin/admissions/:id - Delete admission (admin action, soft delete)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  admissionsController.deleteAdmission
);

export default router;
