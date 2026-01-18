/**
 * Users Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { USER_TYPE } from '@config/constants';
import { FIELD_LIMITS, DEFAULTS, SORTABLE_FIELDS } from '../constants/users.constants';

/**
 * Create user validation schema
 */
export const createUserSchema = Joi.object({
  auth_user_id: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'auth_user_id must be a valid UUID',
    }),

  role: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .required()
    .messages({
      'any.only': `role must be one of: ${Object.values(USER_TYPE).join(', ')}`,
      'any.required': 'role is required',
    }),

  display_name: Joi.string()
    .min(FIELD_LIMITS.DISPLAY_NAME_MIN)
    .max(FIELD_LIMITS.DISPLAY_NAME_MAX)
    .required()
    .messages({
      'string.empty': 'Display name is required',
      'string.min': `Display name must be at least ${FIELD_LIMITS.DISPLAY_NAME_MIN} characters`,
      'string.max': `Display name must not exceed ${FIELD_LIMITS.DISPLAY_NAME_MAX} characters`,
      'any.required': 'Display name is required',
    }),

  organization_id: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'organization_id must be a valid UUID',
    }),

  status: Joi.string()
    .valid('active', 'suspended')
    .optional()
    .default(DEFAULTS.STATUS)
    .messages({
      'any.only': 'status must be either "active" or "suspended"',
    }),
});

/**
 * Update user validation schema
 */
export const updateUserSchema = Joi.object({
  display_name: Joi.string()
    .min(FIELD_LIMITS.DISPLAY_NAME_MIN)
    .max(FIELD_LIMITS.DISPLAY_NAME_MAX)
    .optional()
    .messages({
      'string.min': `Display name must be at least ${FIELD_LIMITS.DISPLAY_NAME_MIN} characters`,
      'string.max': `Display name must not exceed ${FIELD_LIMITS.DISPLAY_NAME_MAX} characters`,
    }),

  organization_id: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'organization_id must be a valid UUID',
    }),
});

/**
 * Update user role validation schema (admin only)
 */
export const updateUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .required()
    .messages({
      'any.only': `role must be one of: ${Object.values(USER_TYPE).join(', ')}`,
      'any.required': 'role is required',
    }),
});

/**
 * Query parameters validation schema
 */
export const userQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must not exceed 100',
    }),

  role: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .optional()
    .messages({
      'any.only': `role must be one of: ${Object.values(USER_TYPE).join(', ')}`,
    }),

  status: Joi.string()
    .valid('active', 'suspended')
    .optional()
    .messages({
      'any.only': 'status must be either "active" or "suspended"',
    }),

  organization_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'organization_id must be a valid UUID',
    }),

  auth_user_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'auth_user_id must be a valid UUID',
    }),

  sort: Joi.string()
    .valid(...SORTABLE_FIELDS)
    .optional()
    .messages({
      'any.only': 'Invalid sort field',
    }),

  order: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .messages({
      'any.only': 'Order must be either "asc" or "desc"',
    }),
});

/**
 * UUID parameter validation schema
 */
export const uuidParamSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'ID must be a valid UUID',
      'any.required': 'ID is required',
    }),
});
