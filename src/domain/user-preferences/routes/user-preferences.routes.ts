/**
 * User Preferences Domain - Routes
 * 
 * Route definitions for user preferences endpoints.
 * Maps HTTP methods and paths to controller functions.
 * 
 * Note: These routes are nested under /api/v1/users/me/preferences
 */

import { Router } from 'express';
import * as userPreferencesController from '../controllers/user-preferences.controller';
import {
  updateUserPreferencesSchema,
  patchUserPreferencesSchema,
} from '../validators/user-preferences.validators';
import { validateBody } from '@shared/middleware/validation';

const router: Router = Router();

/**
 * @swagger
 * /api/v1/users/me/preferences:
 *   get:
 *     summary: Get user preferences
 *     tags: [User Preferences]
 *     description: Get current user's preferences. Returns defaults if preferences don't exist.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved user preferences
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserPreferences'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  userPreferencesController.getUserPreferences
);

/**
 * @swagger
 * /api/v1/users/me/preferences:
 *   put:
 *     summary: Update user preferences
 *     tags: [User Preferences]
 *     description: Update user preferences (upsert). Unspecified fields keep existing/default values.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_notifications_enabled:
 *                 type: boolean
 *                 description: Enable/disable email notifications
 *                 example: true
 *               email_frequency:
 *                 type: string
 *                 enum: [immediate]
 *                 description: Supported value is immediate only. Use email_notifications_enabled to disable email delivery.
 *                 example: 'immediate'
 *               push_notifications_enabled:
 *                 type: boolean
 *                 description: Enable/disable push notifications
 *                 example: true
 *               notification_categories:
 *                 type: object
 *                 properties:
 *                   verification:
 *                     type: boolean
 *                     example: true
 *                   deadline:
 *                     type: boolean
 *                     example: true
 *                   system:
 *                     type: boolean
 *                     example: false
 *                   update:
 *                     type: boolean
 *                     example: true
 *                 description: Category-specific notification preferences
 *               language:
 *                 type: string
 *                 enum: [en, ar, fr, es]
 *                 description: Preferred language
 *                 example: 'en'
 *               timezone:
 *                 type: string
 *                 maxLength: 50
 *                 description: User timezone
 *                 example: 'America/New_York'
 *               theme:
 *                 type: string
 *                 enum: [light, dark, auto]
 *                 description: UI theme preference
 *                 example: 'dark'
 *     responses:
 *       200:
 *         description: User preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserPreferences'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  '/',
  validateBody(updateUserPreferencesSchema),
  userPreferencesController.updateUserPreferences
);

/**
 * @swagger
 * /api/v1/users/me/preferences:
 *   patch:
 *     summary: Partial update user preferences
 *     tags: [User Preferences]
 *     description: Partially update user preferences. Creates preferences if they don't exist (upsert).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_frequency:
 *                 type: string
 *                 enum: [immediate]
 *                 description: Supported value is immediate only.
 *                 example: 'immediate'
 *               language:
 *                 type: string
 *                 enum: [en, ar, fr, es]
 *                 description: Preferred language
 *                 example: 'ar'
 *     responses:
 *       200:
 *         description: User preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserPreferences'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch(
  '/',
  validateBody(patchUserPreferencesSchema),
  userPreferencesController.patchUserPreferences
);

export default router;
