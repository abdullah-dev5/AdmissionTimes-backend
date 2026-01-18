/**
 * User Preferences Domain - Validation Schemas
 * 
 * Joi validation schemas for request validation.
 * Used by validation middleware to validate request bodies and query parameters.
 */

import Joi from 'joi';
import {
  EMAIL_FREQUENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  THEME_OPTIONS,
} from '../constants/user-preferences.constants';

/**
 * Notification categories validation schema
 */
const notificationCategoriesSchema = Joi.object({
  verification: Joi.boolean().optional(),
  deadline: Joi.boolean().optional(),
  system: Joi.boolean().optional(),
  update: Joi.boolean().optional(),
}).unknown(false);

/**
 * Update user preferences validation schema (PUT - all fields optional but validated)
 */
export const updateUserPreferencesSchema = Joi.object({
  email_notifications_enabled: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'email_notifications_enabled must be a boolean',
    }),

  email_frequency: Joi.string()
    .valid(...EMAIL_FREQUENCY_OPTIONS)
    .optional()
    .messages({
      'any.only': `email_frequency must be one of: ${EMAIL_FREQUENCY_OPTIONS.join(', ')}`,
    }),

  push_notifications_enabled: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'push_notifications_enabled must be a boolean',
    }),

  notification_categories: notificationCategoriesSchema
    .optional()
    .messages({
      'object.unknown': 'Invalid notification category key',
    }),

  language: Joi.string()
    .valid(...LANGUAGE_OPTIONS)
    .optional()
    .messages({
      'any.only': `language must be one of: ${LANGUAGE_OPTIONS.join(', ')}`,
    }),

  timezone: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Timezone must not exceed 50 characters',
    }),

  theme: Joi.string()
    .valid(...THEME_OPTIONS)
    .optional()
    .messages({
      'any.only': `theme must be one of: ${THEME_OPTIONS.join(', ')}`,
    }),
});

/**
 * Patch user preferences validation schema (PATCH - all fields optional)
 * Same as update schema, but allows partial updates
 */
export const patchUserPreferencesSchema = updateUserPreferencesSchema;
