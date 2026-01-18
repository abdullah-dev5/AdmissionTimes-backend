/**
 * Deadlines Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { DEADLINE_TYPE } from '@config/constants';
import { DEFAULTS } from '../constants/deadlines.constants';

/**
 * Create deadline validation schema
 */
export const createDeadlineSchema = Joi.object({
  admission_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'admission_id must be a valid UUID',
      'any.required': 'admission_id is required',
    }),

  deadline_type: Joi.string()
    .valid(...Object.values(DEADLINE_TYPE))
    .required()
    .messages({
      'any.only': `deadline_type must be one of: ${Object.values(DEADLINE_TYPE).join(', ')}`,
      'any.required': 'deadline_type is required',
    }),

  deadline_date: Joi.date()
    .iso()
    .required()
    .messages({
      'date.base': 'deadline_date must be a valid ISO8601 date',
      'date.format': 'deadline_date must be in ISO8601 format',
      'any.required': 'deadline_date is required',
    }),

  timezone: Joi.string()
    .optional()
    .default(DEFAULTS.TIMEZONE)
    .messages({
      'string.base': 'timezone must be a string',
    }),

  is_flexible: Joi.boolean()
    .optional()
    .default(DEFAULTS.IS_FLEXIBLE)
    .messages({
      'boolean.base': 'is_flexible must be a boolean',
    }),
});

/**
 * Update deadline validation schema
 */
export const updateDeadlineSchema = Joi.object({
  deadline_type: Joi.string()
    .valid(...Object.values(DEADLINE_TYPE))
    .optional()
    .messages({
      'any.only': `deadline_type must be one of: ${Object.values(DEADLINE_TYPE).join(', ')}`,
    }),

  deadline_date: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.base': 'deadline_date must be a valid ISO8601 date',
      'date.format': 'deadline_date must be in ISO8601 format',
    }),

  timezone: Joi.string()
    .optional()
    .messages({
      'string.base': 'timezone must be a string',
    }),

  is_flexible: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'is_flexible must be a boolean',
    }),

  reminder_sent: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'reminder_sent must be a boolean',
    }),
});

/**
 * Query parameters validation schema
 */
export const deadlineQuerySchema = Joi.object({
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

  admission_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'admission_id must be a valid UUID',
    }),

  deadline_type: Joi.string()
    .valid(...Object.values(DEADLINE_TYPE))
    .optional()
    .messages({
      'any.only': `deadline_type must be one of: ${Object.values(DEADLINE_TYPE).join(', ')}`,
    }),

  is_overdue: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'is_overdue must be a boolean',
    }),

  is_upcoming: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'is_upcoming must be a boolean',
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
    .valid('deadline_date', 'created_at', 'updated_at', 'deadline_type')
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
 * Admission ID parameter validation schema
 */
export const admissionIdParamSchema = Joi.object({
  admissionId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'admissionId must be a valid UUID',
      'any.required': 'admissionId is required',
    }),
});
