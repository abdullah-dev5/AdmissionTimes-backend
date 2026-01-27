/**
 * Auth Domain - Controller Layer
 * 
 * HTTP request/response handling for authentication endpoints.
 * 
 * Responsibilities:
 * - Extract data from HTTP requests
 * - Validate request data
 * - Call service layer
 * - Format HTTP responses
 * - Handle errors
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response } from 'express';
import { sendSuccess, sendError } from '@shared/utils/response';
import * as authService from '../services/auth.service';
import { SignUpDTO, SignInDTO } from '../types/auth.types';
import { signUpSchema, signInSchema } from '../validators/auth.validators';

/**
 * Sign up endpoint handler
 * 
 * POST /api/v1/auth/signup
 */
export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validation = signUpSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
      const errors: Record<string, string> = {};
      validation.error.details.forEach((detail) => {
        const field = detail.path.join('.');
        errors[field] = detail.message;
      });

      sendError(res, 'Validation failed', 400, { errors });
      return;
    }

    const data: SignUpDTO = validation.value;

    // Additional validation: university_id required for university users
    if (data.user_type === 'university' && !data.university_id) {
      sendError(res, 'University ID is required for university accounts', 400, {
        errors: { university_id: 'University ID is required' },
      });
      return;
    }

    // Call service
    const result = await authService.signUp(data);

    // Return success response
    sendSuccess(res, {
      user: result.user,
      message: result.message,
    }, 'Account created successfully', 201);
  } catch (error: any) {
    // Handle AppError (business logic errors)
    if (error.statusCode) {
      // Format error message for email already exists
      const errors: Record<string, string> = {};
      if (error.message.includes('Email already exists')) {
        errors.email = 'Email already exists';
      } else if (error.message.includes('University ID is required')) {
        errors.university_id = 'University ID is required';
      }
      sendError(res, error.message, error.statusCode, Object.keys(errors).length > 0 ? { errors } : null);
      return;
    }

    // Handle unexpected errors
    console.error('Sign up error:', error);
    sendError(res, 'Failed to create account', 500);
  }
};

/**
 * Sign in endpoint handler
 * 
 * POST /api/v1/auth/signin
 */
export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validation = signInSchema.validate(req.body, { abortEarly: false });
    if (validation.error) {
      const errors: Record<string, string> = {};
      validation.error.details.forEach((detail) => {
        const field = detail.path.join('.');
        errors[field] = detail.message;
      });

      sendError(res, 'Validation failed', 400, { errors });
      return;
    }

    const data: SignInDTO = validation.value;

    // Call service
    const result = await authService.signIn(data);

    // Return success response
    sendSuccess(res, {
      user: result.user,
      message: result.message,
    }, 'Signed in successfully', 200);
  } catch (error: any) {
    // Handle AppError (business logic errors)
    if (error.statusCode) {
      sendError(res, error.message, error.statusCode);
      return;
    }

    // Handle unexpected errors
    console.error('Sign in error:', error);
    sendError(res, 'Failed to sign in', 500);
  }
};

/**
 * Sign out endpoint handler
 * 
 * POST /api/v1/auth/signout
 */
export const signOut = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Call service
    const result = await authService.signOut();

    // Return success response
    sendSuccess(res, null, result.message, 200);
  } catch (error: any) {
    console.error('Sign out error:', error);
    sendError(res, 'Failed to sign out', 500);
  }
};

/**
 * Get current user endpoint handler
 * 
 * GET /api/v1/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get user ID from header (development) or JWT token (production)
    const userId = req.headers['x-user-id'] as string;

    if (!userId) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Call service
    const user = await authService.getCurrentUser(userId);

    // Return success response
    sendSuccess(res, user, 'User retrieved successfully', 200);
  } catch (error: any) {
    // Handle AppError (business logic errors)
    if (error.statusCode) {
      sendError(res, error.message, error.statusCode);
      return;
    }

    // Handle unexpected errors
    console.error('Get current user error:', error);
    sendError(res, 'Failed to get user', 500);
  }
};
