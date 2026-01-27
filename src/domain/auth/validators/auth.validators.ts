/**
 * Auth Domain - Validators
 * 
 * Request validation schemas for authentication endpoints.
 */

import Joi from 'joi';
import { USER_TYPE } from '@config/constants';

/**
 * Sign up validation schema
 */
export const signUpSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
    }),

  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required',
    }),

  user_type: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .required()
    .messages({
      'any.only': `User type must be one of: ${Object.values(USER_TYPE).join(', ')}`,
      'any.required': 'User type is required',
    }),

  display_name: Joi.string()
    .max(255)
    .optional()
    .messages({
      'string.max': 'Display name must not exceed 255 characters',
    }),

  university_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'University ID must be a valid UUID',
    }),
});

/**
 * Sign in validation schema
 */
export const signInSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Invalid email format',
      'any.required': 'Email is required',
    }),

  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});
