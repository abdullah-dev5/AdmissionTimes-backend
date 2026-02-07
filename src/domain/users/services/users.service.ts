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
  CreateUserDTO,
  UpdateUserDTO,
  UpdateUserRoleDTO,
  UpdateUniversityProfileDTO,
  UniversityProfile,
  UserFilters,
  UserContext,
} from '../types/users.types';
import { USER_TYPE } from '@config/constants';

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
export const create = async (data: CreateUserDTO): Promise<User> => {
  // Validate required fields
  if (!data.role) {
    throw new AppError('Role is required', 400);
  }

  if (!data.display_name) {
    throw new AppError('Display name is required', 400);
  }

  // If auth_user_id is provided, check if user already exists
  if (data.auth_user_id) {
    const existingUser = await usersModel.findByAuthUserId(data.auth_user_id);
    if (existingUser) {
      throw new AppError('User with this auth_user_id already exists', 409);
    }
  }

  // Validate organization_id for university users
  if (data.role === USER_TYPE.UNIVERSITY && !data.organization_id) {
    // Organization ID is optional but recommended for university users
    // We'll allow it to be null for now
  }

  // Validate organization_id not set for non-university users
  if (data.role !== USER_TYPE.UNIVERSITY && data.organization_id) {
    throw new AppError('Organization ID can only be set for university users', 400);
  }

  return await usersModel.create(data);
};

/**
 * Update current user profile
 * 
 * @param data - Partial user data to update
 * @param userContext - User context
 * @returns Updated user record
 * @throws AppError if not found or access denied
 */
export const updateCurrentUser = async (
  data: UpdateUserDTO,
  userContext?: UserContext
): Promise<User> => {
  if (!userContext || !userContext.id) {
    throw new AppError('User not authenticated', 401);
  }

  const user = await usersModel.findById(userContext.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Validate organization_id for university users
  if (user.role === USER_TYPE.UNIVERSITY && data.organization_id !== undefined) {
    // Allow organization_id update for university users
  }

  // Validate organization_id not set for non-university users
  if (user.role !== USER_TYPE.UNIVERSITY && data.organization_id) {
    throw new AppError('Organization ID can only be set for university users', 400);
  }

  const updated = await usersModel.update(userContext.id, data);

  if (!updated) {
    throw new AppError('User not found', 404);
  }

  return updated;
};

/**
 * Update user role (admin only)
 * 
 * @param id - User UUID
 * @param data - Role update data
 * @param userContext - User context (must be admin)
 * @returns Updated user record
 * @throws AppError if not found or access denied
 */
export const updateRole = async (
  id: string,
  data: UpdateUserRoleDTO,
  userContext?: UserContext
): Promise<User> => {
  // Access control: only admins can update roles
  if (!userContext || userContext.role !== USER_TYPE.ADMIN) {
    throw new AppError('Forbidden', 403);
  }

  const user = await usersModel.findById(id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Validate organization_id for university users
  if (data.role === USER_TYPE.UNIVERSITY && user.organization_id === null) {
    // Organization ID is optional but recommended
    // We'll allow role change without organization_id
  }

  // Clear organization_id if changing from university to non-university
  if (user.role === USER_TYPE.UNIVERSITY && data.role !== USER_TYPE.UNIVERSITY) {
    // Clear organization_id when changing from university role
    await usersModel.update(id, { organization_id: null });
  }

  const updated = await usersModel.updateRole(id, data.role);

  if (!updated) {
    throw new AppError('User not found', 404);
  }

  return updated;
};

/**
 * Get university profile for current user
 * 
 * @param userContext - User context
 * @returns University profile
 */
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

  if (!user.organization_id) {
    throw new AppError('Organization ID not set for university user', 400);
  }

  const existing = await usersModel.findUniversityById(user.organization_id);

  if (existing) {
    return existing as UniversityProfile;
  }

  // Return a minimal profile if record doesn't exist yet
  return {
    id: user.organization_id,
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

  if (!user.organization_id) {
    throw new AppError('Organization ID not set for university user', 400);
  }

  const name = data.name || user.display_name;

  const updated = await usersModel.upsertUniversityProfile(user.organization_id, {
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
export const findOrCreateByAuthUserId = async (
  authUserId: string,
  defaultRole: string = USER_TYPE.STUDENT,
  defaultDisplayName: string = 'User'
): Promise<User> => {
  // Try to find existing user
  let user = await usersModel.findByAuthUserId(authUserId);

  if (user) {
    return user;
  }

  // Create new user if not found
  user = await usersModel.create({
    auth_user_id: authUserId,
    role: defaultRole as any,
    display_name: defaultDisplayName,
    organization_id: null,
    status: 'active',
  });

  return user;
};
