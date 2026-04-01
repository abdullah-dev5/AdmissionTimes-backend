/**
 * User Activity Domain - Service Layer
 * 
 * Business logic and orchestration for user activity.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Create activity records
 * - Coordinate between model and other services
 * - Validate business rules
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as userActivityModel from '../models/user-activity.model';
import { ACTIVITY_TYPE, USER_TYPE } from '@config/constants';
import {
  UserActivity,
  CreateUserActivityDTO,
  UserActivityFilters,
  UserContext,
} from '../types/user-activity.types';

/**
 * Get activity by ID
 * 
 * @param id - Activity UUID
 * @param userContext - User context (for access control)
 * @returns Activity record
 * @throws AppError if not found or access denied
 */
export const getById = async (
  id: string,
  userContext?: UserContext
): Promise<UserActivity> => {
  const activity = await userActivityModel.findById(id);

  if (!activity) {
    throw new AppError('Activity not found', 404);
  }

  // Access control: users can only see their own activities
  if (userContext) {
    if (userContext.id && activity.user_id && activity.user_id !== userContext.id) {
      throw new AppError('Activity not found', 404);
    }
    if (activity.user_type !== userContext.role) {
      throw new AppError('Activity not found', 404);
    }
  }

  return activity;
};

/**
 * Get multiple activities with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @param userContext - User context (for access control)
 * @returns Object with activities array and total count
 */
export const getMany = async (
  filters: UserActivityFilters,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc',
  userContext?: UserContext
): Promise<{ activities: UserActivity[]; total: number }> => {
  // Apply access control filters
  const effectiveFilters = applyAccessControl(filters, userContext);

  // Get activities and total count
  const [activities, total] = await Promise.all([
    userActivityModel.findMany(effectiveFilters, page, limit, sort, order),
    userActivityModel.count(effectiveFilters),
  ]);

  return { activities, total };
};

/**
 * Create a new activity record
 * 
 * @param data - Activity data
 * @returns Created activity record
 */
export const create = async (data: CreateUserActivityDTO): Promise<UserActivity> => {
  // Validate required fields
  if (!data.activity_type) {
    throw new AppError('Activity type is required', 400);
  }

  if (!data.entity_type || !data.entity_id) {
    throw new AppError('Entity type and entity ID are required', 400);
  }

  if (!data.user_type) {
    throw new AppError('User type is required', 400);
  }

  // Ensure metadata is minimal (not too large)
  if (data.metadata && JSON.stringify(data.metadata).length > 1000) {
    throw new AppError('Metadata is too large (max 1000 characters)', 400);
  }

  // Server-side dedup guard for analytics integrity.
  // One view and one click-group event per student per admission.
  const cappedActivityTypes = new Set<string>([
    ACTIVITY_TYPE.VIEWED,
    ACTIVITY_TYPE.SEARCHED,
    ACTIVITY_TYPE.COMPARED,
    ACTIVITY_TYPE.ALERT,
  ]);

  const isStudentAdmissionEvent =
    data.user_type === USER_TYPE.STUDENT &&
    data.entity_type === 'admission' &&
    Boolean(data.user_id) &&
    cappedActivityTypes.has(data.activity_type);

  if (isStudentAdmissionEvent && data.user_id) {
    const existing = await userActivityModel.findExistingCappedStudentAdmissionActivity(
      data.user_id,
      data.entity_id,
      data.activity_type
    );

    if (existing) {
      return existing;
    }
  }

  return await userActivityModel.create(data);
};

/**
 * Apply access control filters based on user context
 * 
 * @param filters - Original filters
 * @param userContext - User context
 * @returns Filters with access control applied
 */
function applyAccessControl(
  filters: UserActivityFilters,
  userContext?: UserContext
): UserActivityFilters {
  const effectiveFilters = { ...filters };

  // If user context exists, filter by user
  if (userContext) {
    effectiveFilters.user_id = userContext.id;
    effectiveFilters.user_type = userContext.role as any;
  }

  return effectiveFilters;
}
