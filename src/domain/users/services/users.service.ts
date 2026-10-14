/**
 * Users Domain - Service Layer
 * 
 * Business logic and orchestration for users.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Identity mapping (Supabase Auth → Internal Users)
 * - Role intent enforcement
 * - Coordinate between model and other services
 * - Validate business rules
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as usersModel from '../models/users.model';
import {
  User,
  UpdateUserDTO,
  UpdateUserRoleDTO,
  UpdateUniversityProfileDTO,
  UniversityProfile,
  UserFilters,
  UserContext,
} from '../types/users.types';
import { USER_TYPE } from '@config/constants';
import { invalidateAuthCache } from '@shared/middleware/jwtAuth';

/**
 * Get user by ID
 * 
 * @param id - User UUID
 * @param userContext - User context (for access control)
 * @returns User record
 * @throws AppError if not found or access denied
 */
export const getById = async (
  id: string,
  userContext?: UserContext
): Promise<User> => {
  const user = await usersModel.findById(id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Access control: users can see their own profile, admins can see all
  if (userContext) {
    // Users can see their own profile
    if (userContext.id === id) {
      return user;
    }

    // Admins can see all users
    if (userContext.role === USER_TYPE.ADMIN) {
      return user;
    }

    // Others cannot see other users
    throw new AppError('User not found', 404);
  }

  // No user context: return user (for system/internal use)
  return user;
};

/**
 * Get current user profile
 * 
 * @param userContext - User context
 * @returns User record
 * @throws AppError if not found
 */
export const getCurrentUser = async (userContext?: UserContext): Promise<User> => {
  if (!userContext || !userContext.id) {
    throw new AppError('User not authenticated', 401);
  }

  const user = await usersModel.findById(userContext.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
};

/**
 * Get multiple users with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @param userContext - User context (for access control)
 * @returns Object with users array and total count
 */
export const getMany = async (
  filters: UserFilters,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc',
  userContext?: UserContext
): Promise<{ users: User[]; total: number }> => {
  // Access control: only admins can list users
  if (!userContext || userContext.role !== USER_TYPE.ADMIN) {
    throw new AppError('Forbidden', 403);
  }

  // Get users and total count
  const [users, total] = await Promise.all([
    usersModel.findMany(filters, page, limit, sort, order),
    usersModel.count(filters),
  ]);

  return { users, total };
};

/**
 * Create a new user
 * 
 * @param data - User data
 * @returns Created user record
 * @throws AppError if validation fails
 */
/**
 * Update the caller's own profile. Only the display name is self-service;
 * role, university and status are admin-managed.
 */
export const updateCurrentUser = async (data: UpdateUserDTO, userContext?: UserContext): Promise<User> => {
  if (!userContext?.id) {
    throw new AppError('User not authenticated', 401);
  }

  const updated = await usersModel.update(userContext.id, { display_name: data.display_name });
  if (!updated) {
    const user = await usersModel.findById(userContext.id);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }
  return updated;
};

/**
 * Change a user's role (admin only). University roles must be linked to an
 * existing university; other roles drop any university link.
 */
export const updateRole = async (id: string, data: UpdateUserRoleDTO, userContext?: UserContext): Promise<User> => {
  if (userContext?.role !== USER_TYPE.ADMIN) {
    throw new AppError('Forbidden', 403);
  }
  if (userContext.id === id && data.role !== USER_TYPE.ADMIN) {
    throw new AppError('Admins cannot remove their own admin role', 409);
  }

  const user = await usersModel.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (data.role === USER_TYPE.UNIVERSITY) {
    if (!data.university_id || !(await usersModel.findUniversityById(data.university_id))) {
      throw new AppError('A valid university_id is required for the university role', 400);
    }
  }

  await usersModel.update(id, { university_id: data.role === USER_TYPE.UNIVERSITY ? data.university_id! : null });
  const updated = await usersModel.updateRole(id, data.role);
  if (!updated) {
    throw new AppError('User not found', 404);
  }

  invalidateAuthCache(user.auth_user_id);
  return updated;
};

/**
 * Suspend or reactivate a user (admin only). Suspended users are rejected by
 * the auth middleware and excluded from notifications.
 */
export const updateStatus = async (
  id: string,
  status: 'active' | 'suspended',
  userContext?: UserContext
): Promise<User> => {
  if (userContext?.role !== USER_TYPE.ADMIN) {
    throw new AppError('Forbidden', 403);
  }
  if (userContext.id === id) {
    throw new AppError('Admins cannot change their own status', 409);
  }

  const updated = await usersModel.updateStatus(id, status);
  if (!updated) {
    throw new AppError('User not found', 404);
  }

  invalidateAuthCache(updated.auth_user_id);
  return updated;
};

export const getUniversityProfile = async (userContext?: UserContext): Promise<UniversityProfile> => {
  if (!userContext || !userContext.id) {
    throw new AppError('User not authenticated', 401);
  }

  const user = await usersModel.findById(userContext.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== USER_TYPE.UNIVERSITY) {
    throw new AppError('Forbidden', 403);
  }

  if (!user.university_id) {
    throw new AppError('University ID not set for university user', 400);
  }

  const existing = await usersModel.findUniversityById(user.university_id);

  if (existing) {
    return existing as UniversityProfile;
  }

  // Return a minimal profile if record doesn't exist yet
  return {
    id: user.university_id,
    name: user.display_name,
    city: null,
    country: null,
    website: null,
    logo_url: null,
    description: null,
    address: null,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Update university profile for current user
 * 
 * @param data - University profile data
 * @param userContext - User context
 * @returns Updated university profile
 */
export const updateUniversityProfile = async (
  data: UpdateUniversityProfileDTO,
  userContext?: UserContext
): Promise<UniversityProfile> => {
  if (!userContext || !userContext.id) {
    throw new AppError('User not authenticated', 401);
  }

  const user = await usersModel.findById(userContext.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role !== USER_TYPE.UNIVERSITY) {
    throw new AppError('Forbidden', 403);
  }

  if (!user.university_id) {
    throw new AppError('University ID not set for university user', 400);
  }

  const name = data.name || user.display_name;

  const updated = await usersModel.upsertUniversityProfile(user.university_id, {
    name,
    city: data.city ?? null,
    country: data.country ?? null,
    website: data.website ?? null,
    logo_url: data.logo_url ?? null,
    description: data.description ?? null,
    address: data.address ?? null,
    contact_name: data.contact_name ?? null,
    contact_email: data.contact_email ?? null,
    contact_phone: data.contact_phone ?? null,
  });

  return updated as UniversityProfile;
};

/**
 * Find or create user by auth_user_id
 * 
 * This is a helper function for identity mapping.
 * When a Supabase Auth user first interacts with the system,
 * we create an internal user record.
 * 
 * @param authUserId - Supabase Auth UUID
 * @param defaultRole - Default role if creating new user
 * @param defaultDisplayName - Default display name if creating new user
 * @returns User record (existing or newly created)
 */
