/**
 * Notifications Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { NOTIFICATION_CATEGORY, NOTIFICATION_PRIORITY, USER_TYPE } from '@config/constants';
import { FIELD_LIMITS, DEFAULTS } from '../constants/notifications.constants';

/**
 * Create notification validation schema
 */
export const createNotificationSchema = Joi.object({
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

  category: Joi.string()
    .valid(...Object.values(NOTIFICATION_CATEGORY))
    .required()
    .messages({
      'any.only': `category must be one of: ${Object.values(NOTIFICATION_CATEGORY).join(', ')}`,
      'any.required': 'category is required',
    }),

  priority: Joi.string()
    .valid(...Object.values(NOTIFICATION_PRIORITY))
    .optional()
    .default(DEFAULTS.PRIORITY)
    .messages({
      'any.only': `priority must be one of: ${Object.values(NOTIFICATION_PRIORITY).join(', ')}`,
    }),

  title: Joi.string()
    .max(FIELD_LIMITS.TITLE_MAX)
    .required()
    .messages({
      'string.empty': 'Title is required',
      'string.max': `Title must not exceed ${FIELD_LIMITS.TITLE_MAX} characters`,
      'any.required': 'Title is required',
    }),

  message: Joi.string()
    .max(FIELD_LIMITS.MESSAGE_MAX)
    .required()
    .messages({
      'string.empty': 'Message is required',
      'string.max': `Message must not exceed ${FIELD_LIMITS.MESSAGE_MAX} characters`,
      'any.required': 'Message is required',
    }),

  related_entity_type: Joi.string()
    .max(FIELD_LIMITS.RELATED_ENTITY_TYPE_MAX)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Related entity type must not exceed ${FIELD_LIMITS.RELATED_ENTITY_TYPE_MAX} characters`,
    }),

  related_entity_id: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'related_entity_id must be a valid UUID',
    }),

  action_url: Joi.string()
    .max(FIELD_LIMITS.ACTION_URL_MAX)
    .uri()
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Action URL must not exceed ${FIELD_LIMITS.ACTION_URL_MAX} characters`,
      'string.uri': 'Action URL must be a valid URI',
    }),
});

/**
 * Query parameters validation schema
 */
export const notificationQuerySchema = Joi.object({
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

  category: Joi.string()
    .valid(...Object.values(NOTIFICATION_CATEGORY))
    .optional()
    .messages({
      'any.only': `category must be one of: ${Object.values(NOTIFICATION_CATEGORY).join(', ')}`,
    }),

  priority: Joi.string()
    .valid(...Object.values(NOTIFICATION_PRIORITY))
    .optional()
    .messages({
      'any.only': `priority must be one of: ${Object.values(NOTIFICATION_PRIORITY).join(', ')}`,
    }),

  is_read: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'is_read must be a boolean',
    }),

  related_entity_type: Joi.string()
    .allow('')
    .optional(),

  related_entity_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'related_entity_id must be a valid UUID',
    }),

  sort: Joi.string()
    .valid('created_at', 'read_at', 'priority', 'category')
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

/**
 * Mark as read validation schema
 */
export const markReadSchema = Joi.object({
  read_at: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'read_at must be a valid ISO8601 date',
      'date.format': 'read_at must be in ISO8601 format',
    }),
});
