/**
 * Admissions Domain - Routes
 * 
 * Route definitions for admissions endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as admissionsController from '../controllers/admissions.controller';
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

// GET /api/v1/admissions - List admissions (public, only verified)
router.get(
  '/',
  validateQuery(admissionQuerySchema),
  admissionsController.getAdmissions
);

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

// POST /api/v1/admissions - Create admission (university)
router.post(
  '/',
  validateBody(createAdmissionSchema),
  admissionsController.createAdmission
);

// PUT /api/v1/admissions/:id - Update admission (university)
router.put(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateAdmissionSchema),
  admissionsController.updateAdmission
);

// PATCH /api/v1/admissions/:id/submit - Submit admission (university - draft to pending)
router.patch(
  '/:id/submit',
  validateParams(uuidParamSchema),
  validateBody(submitAdmissionSchema),
  admissionsController.submitAdmission
);

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

// PATCH /api/v1/admissions/:id/verify - Verify admission (admin)
router.patch(
  '/:id/verify',
  validateParams(uuidParamSchema),
  validateBody(verifyAdmissionSchema),
  admissionsController.verifyAdmission
);

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

// GET /api/v1/admissions/:id/changelogs - Get admission changelogs
router.get(
  '/:id/changelogs',
  validateParams(uuidParamSchema),
  admissionsController.getChangelogs
);

export default router;
