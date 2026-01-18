/**
 * Watchlists Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { FIELD_LIMITS, DEFAULTS, SORTABLE_FIELDS } from '../constants/watchlists.constants';

/**
 * Create watchlist validation schema
 */
export const createWatchlistSchema = Joi.object({
  admission_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'admission_id must be a valid UUID',
      'any.required': 'admission_id is required',
    }),

  notes: Joi.string()
    .max(FIELD_LIMITS.NOTES_MAX)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Notes must not exceed ${FIELD_LIMITS.NOTES_MAX} characters`,
    }),
});

/**
 * Update watchlist validation schema
 */
export const updateWatchlistSchema = Joi.object({
  notes: Joi.string()
    .max(FIELD_LIMITS.NOTES_MAX)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Notes must not exceed ${FIELD_LIMITS.NOTES_MAX} characters`,
    }),
});

/**
 * Query parameters validation schema
 */
export const watchlistQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(DEFAULTS.PAGE)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(DEFAULTS.MAX_LIMIT)
    .optional()
    .default(DEFAULTS.LIMIT)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': `Limit must not exceed ${DEFAULTS.MAX_LIMIT}`,
    }),

  admission_id: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'admission_id must be a valid UUID',
    }),

  sort: Joi.string()
    .valid(...SORTABLE_FIELDS)
    .optional()
    .default(DEFAULTS.SORT)
    .messages({
      'any.only': `Sort must be one of: ${SORTABLE_FIELDS.join(', ')}`,
    }),

  order: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .default(DEFAULTS.ORDER)
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
