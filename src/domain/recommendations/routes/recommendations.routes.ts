/**
 * Recommendations Domain - Routes
 * 
 * Route definitions for recommendations endpoints.
 */

import { Router } from 'express';
import * as recommendationsController from '../controllers/recommendations.controller';

const router: Router = Router();

/**
 * @route GET /api/v1/recommendations
 * @desc Get personalized recommendations for authenticated user
 * @access Student
 */
router.get(
  '/',
  recommendationsController.getMyRecommendations
);

/**
 * @route GET /api/v1/recommendations/count
 * @desc Get recommendation count for authenticated user
 * @access Student
 */
router.get(
  '/count',
  recommendationsController.getRecommendationCount
);

/**
 * @route GET /api/v1/recommendations/observability
 * @desc Get recommendation service observability metrics
 * @access Admin
 */
router.get(
  '/observability',
  recommendationsController.getRecommendationsObservability
);

/**
 * @route POST /api/v1/recommendations/refresh
 * @desc Refresh recommendations for authenticated user
 * @access Student
 */
router.post(
  '/refresh',
  recommendationsController.refreshMyRecommendations
);

/**
 * @route POST /api/v1/recommendations/generate-all
 * @desc Generate recommendations for all users (batch job)
 * @access Admin
 */
router.post(
  '/generate-all',
  recommendationsController.generateAllRecommendations
);

/**
 * @route DELETE /api/v1/recommendations/cleanup
 * @desc Clean up expired recommendations
 * @access Admin
 */
router.delete(
  '/cleanup',
  recommendationsController.cleanupRecommendations
);

export default router;
