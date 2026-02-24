/**
 * Users Domain - Controller Layer
 * 
 * HTTP request/response handlers for users endpoints.
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
import * as usersService from '../services/users.service';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import {
  UpdateUserDTO,
  UpdateUserRoleDTO,
  UpdateUniversityProfileDTO,
  UserQueryParams,
  UserContext,
} from '../types/users.types';

/**
 * Get current user profile
 * 
 * GET /api/v1/users/me
 */
export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    const user = await usersService.getCurrentUser(userContext);

    sendSuccess(res, user, 'User profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 * 
 * PUT /api/v1/users/me
 */
export const updateCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as UpdateUserDTO;
    const userContext = req.user as UserContext | undefined;

    const user = await usersService.updateCurrentUser(data, userContext);

    sendSuccess(res, user, 'User profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (admin only)
 * 
 * GET /api/v1/users/:id
 */
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContext | undefined;

    const user = await usersService.getById(id, userContext);

    sendSuccess(res, user, 'User retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple users with filters and pagination (admin only)
 * 
 * GET /api/v1/users
 */
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as UserQueryParams;
    const userContext = req.user as UserContext | undefined;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract filters
    const filters = {
      role: queryParams.role,
      status: queryParams.status,
      university_id: queryParams.university_id,
      auth_user_id: queryParams.auth_user_id,
    };

    // Extract sort and order
    const sort = queryParams.sort || 'created_at';
    const order = queryParams.order || 'desc';

    // Get users
    const { users, total } = await usersService.getMany(
      filters,
      page,
      limit,
      sort,
      order,
      userContext
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, users, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Update user role (admin only)
 * 
 * PATCH /api/v1/users/:id/role
 */
export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as UpdateUserRoleDTO;
    const userContext = req.user as UserContext | undefined;

    const user = await usersService.updateRole(id, data, userContext);

    sendSuccess(res, user, 'User role updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get current university profile
 * 
 * GET /api/v1/users/me/university-profile
 */
export const getCurrentUniversityProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    const profile = await usersService.getUniversityProfile(userContext);

    sendSuccess(res, profile, 'University profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Update current university profile
 * 
 * PUT /api/v1/users/me/university-profile
 */
export const updateCurrentUniversityProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as UpdateUniversityProfileDTO;
    const userContext = req.user as UserContext | undefined;

    const profile = await usersService.updateUniversityProfile(data, userContext);

    sendSuccess(res, profile, 'University profile updated successfully');
  } catch (error) {
    next(error);
  }
};
