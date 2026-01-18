/**
 * Watchlists Domain - Controller Layer
 * 
 * HTTP request/response handlers for watchlists endpoints.
 * 
 * Responsibilities:
 * - Extract request data (body, params, query)
 * - Call service methods
 * - Format responses using sendSuccess(), sendError(), sendPaginated()
 * - Set appropriate HTTP status codes
 * - Handle async errors with try-catch
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import * as watchlistsService from '../services/watchlists.service';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import { WatchlistQueryParams } from '../types/watchlists.types';

/**
 * User context interface
 * Attached to requests by auth middleware
 */
interface UserContext {
  id: string | null;
  role: 'student' | 'university' | 'admin' | 'guest';
  university_id?: string | null;
}

/**
 * Get user's watchlists with filters and pagination
 * 
 * GET /api/v1/watchlists
 */
export const getWatchlists = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as WatchlistQueryParams;
    const userContext = req.user as UserContext | undefined;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract query params
    const params: WatchlistQueryParams = {
      user_id: '', // Will be overridden by service with authenticated user
      admission_id: queryParams.admission_id,
      page,
      limit,
      sort: queryParams.sort,
      order: queryParams.order,
    };

    // Get watchlists
    const { watchlists, total } = await watchlistsService.getWatchlists(params, userContext);

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, watchlists, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Get single watchlist item by ID
 * 
 * GET /api/v1/watchlists/:id
 */
export const getWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContext | undefined;

    const watchlist = await watchlistsService.getWatchlistById(id, userContext);

    sendSuccess(res, watchlist, 'Watchlist item retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Add admission to watchlist
 * 
 * POST /api/v1/watchlists
 */
export const addToWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as any;
    const userContext = req.user as UserContext | undefined;

    const watchlist = await watchlistsService.addToWatchlist(data, userContext);

    sendSuccess(res, watchlist, 'Admission added to watchlist successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update watchlist item
 * 
 * PATCH /api/v1/watchlists/:id
 */
export const updateWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as any;
    const userContext = req.user as UserContext | undefined;

    const watchlist = await watchlistsService.updateWatchlist(id, data, userContext);

    sendSuccess(res, watchlist, 'Watchlist item updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Remove admission from watchlist
 * 
 * DELETE /api/v1/watchlists/:id
 */
export const removeFromWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContext | undefined;

    await watchlistsService.removeFromWatchlist(id, userContext);

    sendSuccess(res, null, 'Admission removed from watchlist successfully');
  } catch (error) {
    next(error);
  }
};
