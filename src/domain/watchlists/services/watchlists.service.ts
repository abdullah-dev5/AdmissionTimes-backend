/**
 * Watchlists Domain - Service Layer
 * 
 * Business logic and orchestration for watchlists.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Create watchlist items
 * - Coordinate between model and other services
 * - Validate business rules
 * - Track user activity
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as watchlistsModel from '../models/watchlists.model';
import {
  Watchlist,
  CreateWatchlistDTO,
  UpdateWatchlistDTO,
  WatchlistFilters,
  WatchlistQueryParams,
} from '../types/watchlists.types';

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
 * Get watchlist by ID
 * 
 * @param id - Watchlist UUID
 * @param userContext - User context (for access control)
 * @returns Watchlist record
 * @throws AppError if not found or access denied
 */
export const getWatchlistById = async (
  id: string,
  userContext?: UserContext
): Promise<Watchlist> => {
  const watchlist = await watchlistsModel.findById(id);

  if (!watchlist) {
    throw new AppError('Watchlist item not found', 404);
  }

  // Access control: users can only see their own watchlists
  if (userContext && userContext.id && watchlist.user_id !== userContext.id) {
    throw new AppError('Watchlist item not found', 404);
  }

  return watchlist;
};

/**
 * Get user's watchlists with filters and pagination
 * 
 * @param queryParams - Query parameters
 * @param userContext - User context (for access control)
 * @returns Object with watchlists array and total count
 */
export const getWatchlists = async (
  queryParams: WatchlistQueryParams,
  userContext?: UserContext
): Promise<{ watchlists: Watchlist[]; total: number }> => {
  // Access control: users can only see their own watchlists
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  // Override user_id from query params with authenticated user
  const filters: WatchlistFilters = {
    user_id: userContext.id,
    admission_id: queryParams.admission_id,
  };

  const page = queryParams.page || 1;
  const limit = queryParams.limit || 20;
  const sort = queryParams.sort || 'created_at';
  const order = queryParams.order || 'desc';

  // Get watchlists and total count
  const [watchlists, total] = await Promise.all([
    watchlistsModel.findMany(filters, page, limit, sort, order),
    watchlistsModel.count(filters),
  ]);

  return { watchlists, total };
};

/**
 * Add admission to watchlist
 * 
 * @param data - Watchlist data
 * @param userContext - User context
 * @returns Created or existing watchlist record
 * @throws AppError if admission not found
 */
export const addToWatchlist = async (
  data: CreateWatchlistDTO,
  userContext?: UserContext
): Promise<Watchlist> => {
  // Access control: users must be authenticated
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  // Verify admission exists
  try {
    const { findById } = await import('@domain/admissions/models/admissions.model');
    const admission = await findById(data.admission_id, false);
    if (!admission) {
      throw new AppError('Admission not found', 404);
    }
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to verify admission', 500);
  }

  // Create or get existing watchlist (idempotent)
  const watchlist = await watchlistsModel.createOrGet({
    user_id: userContext.id,
    admission_id: data.admission_id,
    notes: data.notes || null,
  });

  // Track activity: watchlisted
  try {
    const { create } = await import('@domain/user-activity/services/user-activity.service');
    const { ACTIVITY_TYPE, USER_TYPE } = await import('@config/constants');
    const { ENTITY_TYPES } = await import('@domain/user-activity/constants/user-activity.constants');

    // Map guest role to student for activity tracking
    const userType = userContext.role === 'guest' 
      ? USER_TYPE.STUDENT 
      : (userContext.role as any) || USER_TYPE.STUDENT;

    await create({
      user_id: userContext.id,
      user_type: userType,
      activity_type: ACTIVITY_TYPE.WATCHLISTED,
      entity_type: ENTITY_TYPES.ADMISSION,
      entity_id: data.admission_id,
      metadata: null,
    });
  } catch (error) {
    // Silently fail - activity tracking should not break the request
    console.error('Failed to track watchlist activity:', error);
  }

  return watchlist;
};

/**
 * Update watchlist item
 * 
 * @param id - Watchlist UUID
 * @param data - Update data
 * @param userContext - User context (for access control)
 * @returns Updated watchlist record
 * @throws AppError if not found or access denied
 */
export const updateWatchlist = async (
  id: string,
  data: UpdateWatchlistDTO,
  userContext?: UserContext
): Promise<Watchlist> => {
  // Access control: users must be authenticated
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  // Verify watchlist exists and belongs to user
  await getWatchlistById(id, userContext);

  // Update watchlist
  const updated = await watchlistsModel.update(id, data);

  if (!updated) {
    throw new AppError('Watchlist item not found', 404);
  }

  return updated;
};

/**
 * Toggle alert opt-in for watchlist item
 *
 * @param id - Watchlist UUID
 * @param userContext - User context (for access control)
 * @returns Updated watchlist record
 */
export const toggleAlert = async (
  id: string,
  userContext?: UserContext
): Promise<Watchlist> => {
  const watchlist = await getWatchlistById(id, userContext);

  return updateWatchlist(
    id,
    { alert_opt_in: !watchlist.alert_opt_in },
    userContext
  );
};

/**
 * Remove admission from watchlist
 * 
 * @param id - Watchlist UUID
 * @param userContext - User context (for access control)
 * @throws AppError if not found or access denied
 */
export const removeFromWatchlist = async (
  id: string,
  userContext?: UserContext
): Promise<void> => {
  // Access control: users must be authenticated
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  // Verify watchlist exists and belongs to user
  await getWatchlistById(id, userContext);

  // Delete watchlist
  const deleted = await watchlistsModel.deleteById(id);

  if (!deleted) {
    throw new AppError('Watchlist item not found', 404);
  }
};

/**
 * Remove watchlist item by admission ID
 *
 * @param admissionId - Admission UUID
 * @param userContext - User context (for access control)
 */
export const removeByAdmissionId = async (
  admissionId: string,
  userContext?: UserContext
): Promise<void> => {
  if (!userContext || !userContext.id) {
    throw new AppError('Authentication required', 401);
  }

  const watchlist = await watchlistsModel.findByUserAndAdmission(
    userContext.id,
    admissionId
  );

  if (!watchlist) {
    throw new AppError('Watchlist item not found', 404);
  }

  const deleted = await watchlistsModel.deleteById(watchlist.id);

  if (!deleted) {
    throw new AppError('Watchlist item not found', 404);
  }
};
