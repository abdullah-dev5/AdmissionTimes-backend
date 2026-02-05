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

const router: Router = express.Router();

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Sign up a new user
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
 *               - user_type
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: student@example.com
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: password123
 *               user_type:
 *                 type: string
 *                 enum: [student, university, admin]
 *                 example: student
 *               display_name:
 *                 type: string
 *                 example: John Doe
 *               university_id:
 *                 type: string
 *                 format: uuid
 *                 example: 412c9cd6-78db-46c1-84e1-c059a20d11bf
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Validation failed or email already exists
 */
router.post('/signup', authController.signUp);

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
router.post('/signin', authController.signIn);

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
