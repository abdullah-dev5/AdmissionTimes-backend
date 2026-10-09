/**
 * Auth Domain - Routes
 * 
 * Express routes for authentication endpoints.
 * 
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints (sign up, sign in, sign out)
 */

import express, { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { jwtAuth } from '@shared/middleware/jwtAuth';
import { validateBody } from '@shared/middleware/validation';
import { signUpSchema, signInSchema } from '../validators/auth.validators';
import { userRateLimit } from '@shared/middleware/userRateLimit';

// Per-IP limits on credential endpoints (generous enough for shared campus IPs).
const credentialLimit = userRateLimit({
  scope: 'auth-credentials',
  limit: 60,
  windowMs: 60_000,
  byIp: true,
  message: 'Too many sign-in attempts. Please wait a minute and try again.',
});

const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Create the student profile for a new Supabase user
 *     description: >
 *       Call after supabase.auth.signUp(). The API verifies via the Supabase
 *       Admin API that auth_user_id belongs to the email. Only student accounts
 *       can self-register; university accounts are created by admins.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, auth_user_id]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               auth_user_id:
 *                 type: string
 *                 format: uuid
 *               display_name:
 *                 type: string
 *               user_type:
 *                 type: string
 *                 enum: [student]
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Validation failed or email already exists
 */
router.post('/signup', credentialLimit, validateBody(signUpSchema), authController.signUp);

/**
 * @swagger
 * /api/v1/auth/signin:
 *   post:
 *     summary: Sign in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Signed in successfully
 *       401:
 *         description: Invalid email or password
 */
router.post('/signin', credentialLimit, validateBody(signInSchema), authController.signIn);

/**
 * @swagger
 * /api/v1/auth/signout:
 *   post:
 *     summary: Sign out a user
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Signed out successfully
 */
router.post('/signout', authController.signOut);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', jwtAuth, authController.getCurrentUser);

export default router;
