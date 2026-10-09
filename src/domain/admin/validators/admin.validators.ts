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
    .valid('verified', 'rejected')
    .required()
    .messages({
      'any.only': 'Status must be verified or rejected',
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
    .max(1000)
    .optional()
    .allow(null, ''),

  verification_comments: Joi.string()
    .max(1000)
    .optional()
    .allow(null, '')
});

/**
 * Request revision schema
 */
export const revisionRequiredSchema = Joi.object({
  reason: Joi.string()
    .min(10)
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Reason is required',
      'string.min': 'Reason must be at least 10 characters',
      'string.max': 'Reason must not exceed 1000 characters',
      'any.required': 'Reason is required',
    }),
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
    .valid('verified', 'rejected')
    .required()
    .messages({
      'any.only': 'Status must be verified or rejected',
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
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'pending', 'verified', 'rejected').optional(),
  // Alias used by the web client; normalized to `status`.
  verification_status: Joi.string().valid('draft', 'pending', 'verified', 'rejected').optional(),
  data_origin: Joi.string().valid('scraper', 'manual', 'university').optional(),
  university_id: Joi.string().uuid().optional(),
  verified_by: Joi.string().uuid().optional(),
  needs_reverification: Joi.boolean().optional(),
  date_from: Joi.date().optional(),
  date_to: Joi.date().min(Joi.ref('date_from')).optional(),
  search: Joi.string().trim().max(100).allow('').optional(),
  sort: Joi.string().valid('created_at', 'updated_at', 'verified_at', 'status', 'deadline', 'title').default('updated_at'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
})
  .rename('verification_status', 'status', { ignoreUndefined: true, override: true })
  .custom((value) => ({ ...value, search: value.search || undefined }));

export const createUniversityRepSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required().messages({
    'string.email': 'Invalid email format',
    'any.required': 'Email is required',
  }),
  display_name: Joi.string().trim().min(2).max(255).required(),
  // Attach to an existing university by id, or by name (created if missing).
  university_id: Joi.string().uuid().optional(),
  university_name: Joi.string().trim().min(2).max(255).optional(),
  city: Joi.string().max(100).optional().allow(null, ''),
  country: Joi.string().max(100).optional().allow(null, ''),
  website: Joi.string().uri().max(255).optional().allow(null, ''),
})
  .or('university_id', 'university_name')
  .messages({ 'object.missing': 'Provide university_id or university_name' });

export const uuidParamSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid admission ID format',
      'any.required': 'Admission ID is required',
    }),
});
