/**
 * User Activity Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { ACTIVITY_TYPE, USER_TYPE } from '@config/constants';

/**
 * Create user activity validation schema
 */
export const createUserActivitySchema = Joi.object({
  user_id: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'user_id must be a valid UUID',
    }),

  user_type: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .required()
    .messages({
      'any.only': `user_type must be one of: ${Object.values(USER_TYPE).join(', ')}`,
      'any.required': 'user_type is required',
    }),

  activity_type: Joi.string()
    .valid(...Object.values(ACTIVITY_TYPE))
    .required()
    .messages({
      'any.only': `activity_type must be one of: ${Object.values(ACTIVITY_TYPE).join(', ')}`,
      'any.required': 'activity_type is required',
    }),

  entity_type: Joi.string()
    .required()
    .messages({
      'string.empty': 'entity_type is required',
      'any.required': 'entity_type is required',
    }),

  entity_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'entity_id must be a valid UUID',
      'any.required': 'entity_id is required',
    }),

  metadata: Joi.object()
    .allow(null)
    .optional()
    .messages({
      'object.base': 'metadata must be a valid JSON object',
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

/**
 * Query parameters validation schema
 */
export const userActivityQuerySchema = Joi.object({
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

  user_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'user_id must be a valid UUID',
    }),

  user_type: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .optional()
    .messages({
      'any.only': `user_type must be one of: ${Object.values(USER_TYPE).join(', ')}`,
    }),

  activity_type: Joi.string()
    .valid(...Object.values(ACTIVITY_TYPE))
    .optional()
    .messages({
      'any.only': `activity_type must be one of: ${Object.values(ACTIVITY_TYPE).join(', ')}`,
    }),

  entity_type: Joi.string()
    .allow('')
    .optional(),

  entity_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'entity_id must be a valid UUID',
    }),

  sort: Joi.string()
    .valid('created_at', 'activity_type', 'entity_type')
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
