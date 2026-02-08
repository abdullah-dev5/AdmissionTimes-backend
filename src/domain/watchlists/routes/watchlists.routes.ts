/**
 * Watchlists Domain - Routes
 * 
 * Route definitions for watchlists endpoints.
 * Maps HTTP methods and paths to controller functions.
 */

import { Router } from 'express';
import * as watchlistsController from '../controllers/watchlists.controller';
import {
  watchlistQuerySchema,
  uuidParamSchema,
  createWatchlistSchema,
  updateWatchlistSchema,
} from '../validators/watchlists.validators';
import { validateBody, validateQuery, validateParams } from '@shared/middleware/validation';

const router: Router = Router();

/**
 * @swagger
 * /api/v1/watchlists:
 *   get:
 *     summary: Get user's watchlists
 *     tags: [Watchlists]
 *     description: Retrieve paginated list of admissions in user's watchlist
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
 *         name: admission_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific admission ID
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at]
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
 *         description: Successfully retrieved watchlists
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
 *                         $ref: '#/components/schemas/Watchlist'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/',
  validateQuery(watchlistQuerySchema),
  watchlistsController.getWatchlists
);

/**
 * @swagger
 * /api/v1/watchlists:
 *   post:
 *     summary: Add admission to watchlist
 *     tags: [Watchlists]
 *     description: Add an admission to user's watchlist. If already exists, returns existing entry (idempotent)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - admission_id
 *             properties:
 *               admission_id:
 *                 type: string
 *                 format: uuid
 *                 description: Admission UUID to add to watchlist
 *                 example: '123e4567-e89b-12d3-a456-426614174000'
 *               notes:
 *                 type: string
 *                 maxLength: 5000
 *                 description: Optional notes about this admission
 *                 example: 'Interested in this program'
 *     responses:
 *       201:
 *         description: Admission added to watchlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Watchlist'
 *       400:
 *         description: Validation error or admission not found
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
 *       404:
 *         description: Admission not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/',
  validateBody(createWatchlistSchema),
  watchlistsController.addToWatchlist
);

/**
 * @swagger
 * /api/v1/watchlists/{id}:
 *   get:
 *     summary: Get watchlist item by ID
 *     tags: [Watchlists]
 *     description: Get specific watchlist item by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Watchlist item UUID
 *     responses:
 *       200:
 *         description: Successfully retrieved watchlist item
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Watchlist'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Watchlist item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/:id',
  validateParams(uuidParamSchema),
  watchlistsController.getWatchlist
);

/**
 * @swagger
 * /api/v1/watchlists/{id}:
 *   patch:
 *     summary: Update watchlist item
 *     tags: [Watchlists]
 *     description: Update notes for a watchlist item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Watchlist item UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 5000
 *                 description: Optional notes about this admission
 *                 example: 'Updated notes'
 *               alert_opt_in:
 *                 type: boolean
 *                 description: Enable or disable alert notifications for this admission
 *                 example: true
 *     responses:
 *       200:
 *         description: Watchlist item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Watchlist'
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
 *       404:
 *         description: Watchlist item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch(
  '/:id',
  validateParams(uuidParamSchema),
  validateBody(updateWatchlistSchema),
  watchlistsController.updateWatchlist
);

/**
 * @swagger
 * /api/v1/watchlists/{id}:
 *   delete:
 *     summary: Remove admission from watchlist
 *     tags: [Watchlists]
 *     description: Remove an admission from user's watchlist
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Watchlist item UUID
 *     responses:
 *       200:
 *         description: Admission removed from watchlist successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Watchlist item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  '/:id',
  validateParams(uuidParamSchema),
  watchlistsController.removeFromWatchlist
);

export default router;
