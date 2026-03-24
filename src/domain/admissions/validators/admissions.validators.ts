/**
 * Admissions Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import { FIELD_LIMITS, VALIDATION_RULES, DEFAULTS } from '../constants/admissions.constants';

/**
 * Create admission validation schema
 */
export const createAdmissionSchema = Joi.object({
  title: Joi.string()
    .max(FIELD_LIMITS.TITLE_MAX)
    .required()
    .messages({
      'string.empty': 'Title is required',
      'string.max': `Title must not exceed ${FIELD_LIMITS.TITLE_MAX} characters`,
      'any.required': 'Title is required',
    }),

  description: Joi.string()
    .max(FIELD_LIMITS.DESCRIPTION_MAX)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Description must not exceed ${FIELD_LIMITS.DESCRIPTION_MAX} characters`,
    }),

  program_type: Joi.string()
    .allow(null, '')
    .optional(),

  degree_level: Joi.string()
    .allow(null, '')
    .optional(),

  field_of_study: Joi.string()
    .max(FIELD_LIMITS.FIELD_OF_STUDY_MAX)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Field of study must not exceed ${FIELD_LIMITS.FIELD_OF_STUDY_MAX} characters`,
    }),

  duration: Joi.string()
    .max(FIELD_LIMITS.DURATION_MAX)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Duration must not exceed ${FIELD_LIMITS.DURATION_MAX} characters`,
    }),

  tuition_fee: Joi.number()
    .min(VALIDATION_RULES.TUITION_FEE_MIN)
    .allow(null)
    .optional()
    .messages({
      'number.min': `Tuition fee must be at least ${VALIDATION_RULES.TUITION_FEE_MIN}`,
      'number.base': 'Tuition fee must be a valid number',
    }),

  currency: Joi.string()
    .length(FIELD_LIMITS.CURRENCY_LENGTH)
    .allow(null, '')
    .optional()
    .messages({
      'string.length': `Currency must be a ${FIELD_LIMITS.CURRENCY_LENGTH}-character ISO code`,
    }),

  application_fee: Joi.number()
    .min(VALIDATION_RULES.APPLICATION_FEE_MIN)
    .allow(null)
    .optional()
    .messages({
      'number.min': `Application fee must be at least ${VALIDATION_RULES.APPLICATION_FEE_MIN}`,
      'number.base': 'Application fee must be a valid number',
    }),

  deadline: Joi.date()
    .iso()
    .greater('now')
    .allow(null)
    .optional()
    .messages({
      'date.base': 'Deadline must be a valid ISO8601 date',
      'date.greater': 'Deadline must be in the future',
      'date.format': 'Deadline must be in ISO8601 format',
    }),

  start_date: Joi.date()
    .iso()
    .allow(null)
    .optional()
    .messages({
      'date.base': 'Start date must be a valid ISO8601 date',
      'date.format': 'Start date must be in ISO8601 format',
    }),

  location: Joi.string()
    .max(FIELD_LIMITS.LOCATION_MAX)
    .allow(null, '')
    .optional()
    .messages({
      'string.max': `Location must not exceed ${FIELD_LIMITS.LOCATION_MAX} characters`,
    }),

  delivery_mode: Joi.string()
    .valid(...DEFAULTS.DELIVERY_MODE_OPTIONS)
    .allow(null, '')
    .optional()
    .messages({
      'any.only': `Delivery mode must be one of: ${DEFAULTS.DELIVERY_MODE_OPTIONS.join(', ')}`,
    }),

  requirements: Joi.object()
    .allow(null)
    .optional()
    .messages({
      'object.base': 'Requirements must be a valid JSON object',
    }),

  verification_status: Joi.string()
    .valid('draft', 'pending', 'verified', 'rejected')
    .optional()
    .default('draft'),

  university_id: Joi.string()
    .uuid()
    .optional(),
});

/**
 * Update admission validation schema
 * Same as create, but all fields are optional
 */
export const updateAdmissionSchema = createAdmissionSchema.fork(
  Object.keys(createAdmissionSchema.describe().keys),
  (schema) => schema.optional()
);

/**
 * Verify admission validation schema
 */
export const verifyAdmissionSchema = Joi.object({
  verified_by: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'verified_by must be a valid UUID',
    }),
});

/**
 * Reject admission validation schema
 */
export const rejectAdmissionSchema = Joi.object({
  rejection_reason: Joi.string()
    .min(FIELD_LIMITS.REJECTION_REASON_MIN)
    .max(FIELD_LIMITS.REJECTION_REASON_MAX)
    .required()
    .messages({
      'string.empty': 'Rejection reason is required',
      'string.min': `Rejection reason must be at least ${FIELD_LIMITS.REJECTION_REASON_MIN} characters`,
      'string.max': `Rejection reason must not exceed ${FIELD_LIMITS.REJECTION_REASON_MAX} characters`,
      'any.required': 'Rejection reason is required',
    }),

  rejected_by: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'rejected_by must be a valid UUID',
    }),
});

/**
 * Admin verify/reject validation schema (alias endpoint)
 */
export const adminVerifyAdmissionSchema = Joi.object({
  verification_status: Joi.string()
    .valid('verified', 'rejected')
    .required()
    .messages({
      'any.only': 'verification_status must be either "verified" or "rejected"',
      'any.required': 'verification_status is required',
    }),

  verified_by: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'verified_by must be a valid UUID',
    }),

  rejected_by: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'rejected_by must be a valid UUID',
    }),

  rejection_reason: Joi.string()
    .min(FIELD_LIMITS.REJECTION_REASON_MIN)
    .max(FIELD_LIMITS.REJECTION_REASON_MAX)
    .when('verification_status', {
      is: 'rejected',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ''),
    })
    .messages({
      'string.empty': 'Rejection reason is required',
      'string.min': `Rejection reason must be at least ${FIELD_LIMITS.REJECTION_REASON_MIN} characters`,
      'string.max': `Rejection reason must not exceed ${FIELD_LIMITS.REJECTION_REASON_MAX} characters`,
      'any.required': 'Rejection reason is required',
    }),

  notes: Joi.string()
    .max(FIELD_LIMITS.REJECTION_REASON_MAX)
    .allow(null, '')
    .optional(),
});

/**
 * Query parameters validation schema
 */
export const admissionQuerySchema = Joi.object({
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

  search: Joi.string()
    .allow('')
    .optional(),

  program_type: Joi.string()
    .allow('')
    .optional(),

  degree_level: Joi.string()
    .allow('')
    .optional(),

  field_of_study: Joi.string()
    .allow('')
    .optional(),

  location: Joi.string()
    .allow('')
    .optional(),

  delivery_mode: Joi.string()
    .valid(...DEFAULTS.DELIVERY_MODE_OPTIONS)
    .allow('')
    .optional(),

  verification_status: Joi.alternatives()
    .try(
      Joi.string().valid('draft', 'pending', 'verified', 'rejected'),
      Joi.array().items(Joi.string().valid('draft', 'pending', 'verified', 'rejected'))
    )
    .optional(),

  created_by: Joi.string()
    .uuid()
    .allow('')
    .optional()
    .messages({
      'string.guid': 'created_by must be a valid UUID',
    }),

  sort: Joi.string()
    .valid('created_at', 'updated_at', 'deadline', 'title', 'tuition_fee', 'verified_at')
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
 * Submit admission validation schema
 */
export const submitAdmissionSchema = Joi.object({
  submitted_by: Joi.string()
    .uuid()
    .allow(null, '')
    .optional()
    .messages({
      'string.guid': 'submitted_by must be a valid UUID',
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
