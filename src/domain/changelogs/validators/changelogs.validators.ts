/**
 * Changelogs Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { SORTABLE_FIELDS } from '../constants/changelogs.constants';

/**
 * Query parameters validation schema
 */
export const changelogQuerySchema = Joi.object({
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

  actor_type: Joi.string()
    .valid('admin', 'university', 'system')
    .allow('')
    .optional()
    .messages({
      'any.only': 'actor_type must be one of: admin, university, system',
    }),

  action_type: Joi.string()
    .valid('created', 'updated', 'verified', 'rejected', 'status_changed')
    .allow('')
    .optional()
    .messages({
      'any.only': 'action_type must be one of: created, updated, verified, rejected, status_changed',
    }),

  changed_by: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'changed_by must be a valid UUID',
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

  search: Joi.string()
    .allow('')
    .optional()
    .messages({
      'string.base': 'search must be a string',
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
