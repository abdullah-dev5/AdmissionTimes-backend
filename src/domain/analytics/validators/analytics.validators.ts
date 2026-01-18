/**
 * Analytics Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { ANALYTICS_EVENT_TYPE, USER_TYPE } from '@config/constants';
import { SORTABLE_FIELDS } from '../constants/analytics.constants';

/**
 * Create analytics event validation schema
 */
export const createAnalyticsEventSchema = Joi.object({
  event_type: Joi.string()
    .valid(...Object.values(ANALYTICS_EVENT_TYPE))
    .required()
    .messages({
      'any.only': `event_type must be one of: ${Object.values(ANALYTICS_EVENT_TYPE).join(', ')}`,
      'any.required': 'event_type is required',
    }),

  entity_type: Joi.string()
    .max(100)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': 'entity_type must not exceed 100 characters',
    }),

  entity_id: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'entity_id must be a valid UUID',
    }),

  user_type: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .allow(null, '')
    .optional()
    .messages({
      'any.only': `user_type must be one of: ${Object.values(USER_TYPE).join(', ')}`,
    }),

  user_id: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'user_id must be a valid UUID',
    }),

  metadata: Joi.object()
    .allow(null)
    .optional()
    .messages({
      'object.base': 'metadata must be an object',
    }),
});

/**
 * Query parameters validation schema
 */
export const analyticsQuerySchema = Joi.object({
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

  event_type: Joi.string()
    .valid(...Object.values(ANALYTICS_EVENT_TYPE))
    .optional()
    .messages({
      'any.only': `event_type must be one of: ${Object.values(ANALYTICS_EVENT_TYPE).join(', ')}`,
    }),

  entity_type: Joi.string()
    .max(100)
    .allow('')
    .optional()
    .messages({
      'string.max': 'entity_type must not exceed 100 characters',
    }),

  entity_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'entity_id must be a valid UUID',
    }),

  user_type: Joi.string()
    .valid(...Object.values(USER_TYPE))
    .allow('')
    .optional()
    .messages({
      'any.only': `user_type must be one of: ${Object.values(USER_TYPE).join(', ')}`,
    }),

  user_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'user_id must be a valid UUID',
    }),

  date_from: Joi.date()
    .iso()
    .allow('')
    .optional()
    .messages({
      'date.base': 'date_from must be a valid ISO8601 date',
      'date.format': 'date_from must be in ISO8601 format',
    }),

  date_to: Joi.date()
    .iso()
    .allow('')
    .optional()
    .messages({
      'date.base': 'date_to must be a valid ISO8601 date',
      'date.format': 'date_to must be in ISO8601 format',
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
