/**
 * Admin Domain - Validators
 * 
 * Input validation schemas using Joi
 * Validates request data before passing to service layer
 */

import Joi from 'joi';

/**
 * Verify admission schema
 */
export const verifyAdmissionSchema = Joi.object({
  verification_status: Joi.string()
    .valid('verified', 'rejected', 'disputed')
    .required()
    .messages({
      'any.only': 'Status must be verified, rejected, or disputed',
      'any.required': 'Verification status is required',
    }),

  rejection_reason: Joi.string()
    .min(10)
    .max(500)
    .when('verification_status', {
      is: 'rejected',
      then: Joi.required().messages({
        'any.required': 'Rejection reason is required when rejecting',
        'string.min': 'Rejection reason must be at least 10 characters',
      }),
      otherwise: Joi.optional().allow(null, ''),
    }),

  admin_notes: Joi.string()
    .min(10)
    .max(1000)
    .when('verification_status', {
      is: 'disputed',
      then: Joi.required().messages({
        'any.required': 'Reason is required when disputing',
        'string.min': 'Reason must be at least 10 characters',
      }),
      otherwise: Joi.optional().allow(null, ''),
    }),

  verification_comments: Joi.string()
    .max(1000)
    .optional()
    .allow(null, '')
});

/**
 * Bulk verify schema
 */
export const bulkVerifySchema = Joi.object({
  admission_ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required()
    .messages({
      'array.base': 'admission_ids must be an array',
      'array.min': 'At least one admission ID is required',
      'any.required': 'admission_ids is required',
    }),

  verification_status: Joi.string()
    .valid('verified', 'rejected', 'disputed')
    .required()
    .messages({
      'any.only': 'Status must be verified, rejected, or disputed',
      'any.required': 'Verification status is required',
    }),

  rejection_reason: Joi.string()
    .min(10)
    .max(500)
    .when('verification_status', {
      is: 'rejected',
      then: Joi.required(),
      otherwise: Joi.optional().allow(null, ''),
    }),

  admin_notes: Joi.string()
    .max(1000)
    .optional()
    .allow(null, ''),
});

/**
 * Admin filter query schema
 */
export const adminFilterSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20),

  status: Joi.string()
    .valid('draft', 'pending', 'verified', 'rejected', 'disputed')
    .optional(),

  university_id: Joi.string()
    .uuid()
    .optional(),

  verified_by: Joi.string()
    .uuid()
    .optional(),

  date_from: Joi.date()
    .optional(),

  date_to: Joi.date()
    .min(Joi.ref('date_from'))
    .optional(),

  search: Joi.string()
    .max(100)
    .optional(),

  sort: Joi.string()
    .valid('created_at', 'verified_at', 'status')
    .default('created_at'),

  order: Joi.string()
    .valid('asc', 'desc')
    .default('desc'),
});

/**
 * UUID param schema
 */
export const uuidParamSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid admission ID format',
      'any.required': 'Admission ID is required',
    }),
});
