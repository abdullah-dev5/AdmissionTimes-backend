/**
 * University Admissions Routes
 * 
 * Alias routes for frontend compatibility.
 * These map /api/v1/university/admissions to the core admissions controllers.
 */

import { Router } from 'express';
import * as admissionsController from '../controllers/admissions.controller';
import {
  createAdmissionSchema,
  updateAdmissionSchema,
  submitAdmissionSchema,
  admissionQuerySchema,
  uuidParamSchema,
} from '../validators/admissions.validators';
import { validateBody, validateQuery, validateParams } from '@shared/middleware/validation';

const router: Router = Router();

// GET /api/v1/university/admissions - List admissions
router.get(
  '/',
  validateQuery(admissionQuerySchema),
  admissionsController.getAdmissions
);

// POST /api/v1/university/admissions - Create admission
router.post(
  '/',
  validateBody(createAdmissionSchema),
  admissionsController.createAdmission
);

// PUT /api/v1/university/admissions/:id - Update admission
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAdmissionSchema),
  admissionsController.updateAdmission
);

// DELETE /api/v1/university/admissions/:id - Delete admission (soft delete)
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  admissionsController.deleteAdmission
);

// POST /api/v1/university/admissions/:id/request-verification - Submit admission
router.post(
  '/:id/request-verification',
  validateParams(uuidParamSchema),
  validateBody(submitAdmissionSchema),
  admissionsController.submitAdmission
);

export default router;
