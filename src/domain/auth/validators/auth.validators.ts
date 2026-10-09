/**
 * Auth Domain - Validators
 */

import Joi from 'joi';

/**
 * Public self-service signup creates STUDENT profiles only.
 * University representatives are provisioned by admins
 * (POST /admin/university-reps); admins are seeded.
 */
export const signUpSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(255).required(),
  // Credentials are owned by Supabase Auth. Older clients still send the
  // password here; it is discarded and never stored.
  password: Joi.any().strip(),
  university_id: Joi.any().strip(),
  user_type: Joi.string().valid('student').default('student').messages({
    'any.only': 'Only student accounts can be created through signup. University accounts are created by an administrator.',
  }),
  display_name: Joi.string().trim().max(255).optional(),
  auth_user_id: Joi.string().uuid().required().messages({
    'any.required': 'auth_user_id (Supabase user id) is required',
  }),
});

export const signInSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});
