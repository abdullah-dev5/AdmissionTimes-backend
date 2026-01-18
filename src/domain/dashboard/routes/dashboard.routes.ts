/**
 * Dashboard Domain - Routes
 * 
 * Route definitions for dashboard endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';

const router: Router = Router();

/**
 * @swagger
 * /api/v1/student/dashboard:
 *   get:
 *     summary: Get student dashboard data
 *     tags: [Dashboard]
 *     description: Retrieve aggregated dashboard data for student users including stats, recommendations, deadlines, and notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                             active_admissions:
 *                               type: number
 *                             saved_count:
 *                               type: number
 *                             upcoming_deadlines:
 *                               type: number
 *                             recommendations_count:
 *                               type: number
 *                             unread_notifications:
 *                               type: number
 *                             urgent_deadlines:
 *                               type: number
 *                         recommended_programs:
 *                           type: array
 *                           items:
 *                             type: object
 *                         upcoming_deadlines:
 *                           type: array
 *                           items:
 *                             type: object
 *                         recent_notifications:
 *                           type: array
 *                           items:
 *                             type: object
 *                         recent_activity:
 *                           type: array
 *                           items:
 *                             type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Student role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/student/dashboard - Get student dashboard
router.get('/student/dashboard', dashboardController.getStudentDashboard);

/**
 * @swagger
 * /api/v1/university/dashboard:
 *   get:
 *     summary: Get university dashboard data
 *     tags: [Dashboard]
 *     description: Retrieve aggregated dashboard data for university users including stats, admissions, verifications, and notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                             total_admissions:
 *                               type: number
 *                             pending_verification:
 *                               type: number
 *                             verified_admissions:
 *                               type: number
 *                             recent_updates:
 *                               type: number
 *                             unread_notifications:
 *                               type: number
 *                             pending_audits:
 *                               type: number
 *                         recent_admissions:
 *                           type: array
 *                           items:
 *                             type: object
 *                         pending_verifications:
 *                           type: array
 *                           items:
 *                             type: object
 *                         recent_changes:
 *                           type: array
 *                           items:
 *                             type: object
 *                         recent_notifications:
 *                           type: array
 *                           items:
 *                             type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - University role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/university/dashboard - Get university dashboard
router.get('/university/dashboard', dashboardController.getUniversityDashboard);

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     tags: [Dashboard]
 *     description: Retrieve aggregated dashboard data for admin users including system-wide stats and pending verifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                             pending_verifications:
 *                               type: number
 *                             total_admissions:
 *                               type: number
 *                             total_universities:
 *                               type: number
 *                             total_students:
 *                               type: number
 *                             recent_actions:
 *                               type: number
 *                             scraper_jobs_running:
 *                               type: number
 *                         pending_verifications:
 *                           type: array
 *                           items:
 *                             type: object
 *                         recent_actions:
 *                           type: array
 *                           items:
 *                             type: object
 *                         scraper_activity:
 *                           type: array
 *                           items:
 *                             type: object
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/admin/dashboard - Get admin dashboard
router.get('/admin/dashboard', dashboardController.getAdminDashboard);

/**
 * @swagger
 * /api/v1/student/recommendations:
 *   get:
 *     summary: Get personalized recommendations for student
 *     tags: [Dashboard]
 *     description: Retrieve personalized admission recommendations based on student preferences and profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of recommendations to return
 *       - in: query
 *         name: min_score
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           default: 75
 *         description: Minimum match score (0-100)
 *     responses:
 *       200:
 *         description: Recommendations retrieved successfully
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
 *                         type: object
 *                         properties:
 *                           admission_id:
 *                             type: string
 *                             format: uuid
 *                           score:
 *                             type: number
 *                             minimum: 0
 *                             maximum: 100
 *                           reason:
 *                             type: string
 *                           factors:
 *                             type: object
 *                             properties:
 *                               degree_match:
 *                                 type: number
 *                               deadline_proximity:
 *                                 type: number
 *                               location_preference:
 *                                 type: number
 *                               gpa_match:
 *                                 type: number
 *                               interest_match:
 *                                 type: number
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Student role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/student/recommendations - Get student recommendations
router.get('/student/recommendations', dashboardController.getStudentRecommendations);

export default router;
