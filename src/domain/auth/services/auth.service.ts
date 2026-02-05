/**
 * Auth Domain - Service Layer
 * 
 * Business logic and orchestration for authentication.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Validate user data
 * - Handle authentication logic
 * - Return formatted responses
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as authModel from '../models/auth.model';
import { SignUpDTO, SignInDTO, SignUpResponse, SignInResponse, AuthUser } from '../types/auth.types';

/**
 * Sign up a new user
 * 
 * @param data - Sign up data
 * @returns Sign up response
 * @throws AppError if validation fails or email already exists
 */
export const signUp = async (data: SignUpDTO): Promise<SignUpResponse> => {
  // Check if email already exists
  const emailExists = await authModel.emailExists(data.email);
  if (emailExists) {
    throw new AppError('Email already exists', 400);
  }

  // Validate university_id for university users
  if (data.user_type === 'university') {
    if (!data.university_id) {
      throw new AppError('University ID is required for university accounts', 400);
    }

    // Verify university exists (check if organization_id exists in users table or create universities table check)
    // For now, we'll just validate the UUID format - actual university validation can be added later
    // when universities table is created
  }

  // Create user
  const user = await authModel.createUser(data);

  return {
    user,
    message: 'Account created successfully',
  };
};

/**
 * Sign in a user
 * 
 * @param data - Sign in data
 * @returns Sign in response
 * @throws AppError if credentials are invalid
 */
export const signIn = async (data: SignInDTO): Promise<SignInResponse> => {
  // Verify credentials
  const user = await authModel.verifyCredentials(data.email, data.password);

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  return {
    user,
    message: 'Signed in successfully',
  };
};

/**
 * Sign out a user
 * 
 * For basic auth, this is just a placeholder.
 * In future, will invalidate JWT tokens.
 * 
 * @returns Success message
 */
export const signOut = async (): Promise<{ message: string }> => {
  // For basic auth, just return success
  // In future, will invalidate JWT tokens
  return {
    message: 'Signed out successfully',
  };
};

/**
 * Get current user
 * 
 * @param userId - User ID from JWT middleware (database ID, not auth_user_id)
 * @returns User data
 * @throws AppError if user not found
 */
export const getCurrentUser = async (userId: string): Promise<AuthUser> => {
  // JWT middleware now returns database ID, not auth_user_id
  // Use findUserById instead of findUserByAuthUserId
  const user = await authModel.findUserById(userId);

  if (!user) {
    throw new AppError('User not found', 401);
  }

  return user;
};
