/**
 * Users Domain - Routes
 * 
 * Route definitions for users endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as usersController from '../controllers/users.controller';
import {
  updateUserSchema,
  updateUserRoleSchema,
  updateUniversityProfileSchema,
  userQuerySchema,
  uuidParamSchema,
} from '../validators/users.validators';
import { validateBody, validateQuery, validateParams } from '@shared/middleware/validation';
import userPreferencesRoutes from '../../user-preferences/routes/user-preferences.routes';

const router: Router = Router();

/**
 * User Endpoints
 */

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     description: Retrieve the profile of the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/users/me - Get current user profile
router.get(
  '/me',
  usersController.getCurrentUser
);

/**
 * @swagger
 * /api/v1/users/me:
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     description: Update the profile of the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 description: User display name
 *               organization_id:
 *                 type: string
 *                 format: uuid
 *                 description: Organization ID (for university users only)
 *     responses:
 *       200:
 *         description: Successfully updated user profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
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
// PUT /api/v1/users/me - Update current user profile
router.put(
  '/me',
  validateBody(updateUserSchema),
  usersController.updateCurrentUser
);

// GET /api/v1/users/me/university-profile - Get university profile
router.get(
  '/me/university-profile',
  usersController.getCurrentUniversityProfile
);

// PUT /api/v1/users/me/university-profile - Update university profile
router.put(
  '/me/university-profile',
  validateBody(updateUniversityProfileSchema),
  usersController.updateCurrentUniversityProfile
);

// User Preferences routes (nested under /api/v1/users/me/preferences)
router.use('/me/preferences', userPreferencesRoutes);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List users (admin only)
 *     tags: [Users]
 *     description: Retrieve paginated list of users. Only accessible by admins.
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [student, university, admin]
 *         description: Filter by user role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended]
 *         description: Filter by user status
 *       - in: query
 *         name: organization_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by organization ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, display_name, role, status]
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
 *         description: Successfully retrieved users
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
 *                         $ref: '#/components/schemas/User'
 *       403:
 *         description: Forbidden (admin only)
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
// GET /api/v1/users - List users (admin only)
router.get(
  '/',
  validateQuery(userQuerySchema),
  usersController.getUsers
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     description: Retrieve a specific user by ID. Users can see their own profile, admins can see all users.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved user
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found or access denied
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
// GET /api/v1/users/:id - Get user by ID
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  usersController.getUser
);

/**
 * @swagger
 * /api/v1/users/{id}/role:
 *   patch:
 *     summary: Update user role (admin only)
 *     tags: [Users]
 *     description: Update the role of a user. Only accessible by admins.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [student, university, admin]
 *                 description: New user role
 *     responses:
 *       200:
 *         description: Successfully updated user role
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (admin only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
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
// PATCH /api/v1/users/:id/role - Update user role (admin only)
router.patch(
  '/:id/role',
  validateParams(uuidParamSchema),
  validateBody(updateUserRoleSchema),
  usersController.updateUserRole
);

/**
 * @swagger
 * /api/v1/users/me/university-profile:
 *   get:
 *     summary: Get current university profile
 *     tags: [Users]
 *     description: Retrieve the university profile for the currently authenticated university user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved university profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UniversityProfile'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden (university users only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: University profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/v1/users/me/university-profile - Get current university profile
router.get(
  '/me/university-profile',
  usersController.getCurrentUniversityProfile
);

/**
 * @swagger
 * /api/v1/users/me/university-profile:
 *   put:
 *     summary: Update current university profile
 *     tags: [Users]
 *     description: Update the university profile for the currently authenticated university user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: University name
 *               city:
 *                 type: string
 *                 maxLength: 100
 *                 description: City where university is located
 *               country:
 *                 type: string
 *                 maxLength: 100
 *                 description: Country where university is located
 *               website:
 *                 type: string
 *                 maxLength: 255
 *                 format: url
 *                 description: University website URL
 *               logo_url:
 *                 type: string
 *                 description: University logo image URL or base64 data URL
 *               description:
 *                 type: string
 *                 description: University description
 *               address:
 *                 type: string
 *                 description: University physical address
 *               contact_name:
 *                 type: string
 *                 maxLength: 255
 *                 description: Contact person name
 *               contact_email:
 *                 type: string
 *                 format: email
 *                 description: Contact person email
 *               contact_phone:
 *                 type: string
 *                 maxLength: 50
 *                 description: Contact person phone number
 *     responses:
 *       200:
 *         description: Successfully updated university profile
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UniversityProfile'
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
 *       403:
 *         description: Forbidden (university users only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: University profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PUT /api/v1/users/me/university-profile - Update current university profile
router.put(
  '/me/university-profile',
  validateBody(updateUniversityProfileSchema),
  usersController.updateCurrentUniversityProfile
);

export default router;
