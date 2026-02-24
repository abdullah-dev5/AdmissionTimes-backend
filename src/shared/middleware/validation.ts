/**
 * Validation Middleware
 * 
 * Validates request bodies and query parameters using Joi schemas.
 * Attaches validated data to req.validated for use in controllers.
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { sendError } from '../utils/response';

/**
 * Extend Express Request to include validated data
 */
declare global {
  namespace Express {
    interface Request {
      validated?: any;
    }
  }
}

/**
 * Validate request body using Joi schema
 * 
 * @param schema - Joi validation schema
 * @returns Middleware function
 */
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Ensure req.body is always an object for validation
    const bodyToValidate = req.body || {};
    
    const { error, value } = schema.validate(bodyToValidate, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach((detail) => {
        const field = detail.path.join('.');
        errors[field] = detail.message;
      });

      return sendError(res, 'Validation error', 400, errors);
    }

    req.validated = value;
    next();
  };
};

/**
 * Validate query parameters using Joi schema
 * 
 * @param schema - Joi validation schema
 * @returns Middleware function
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach((detail) => {
        const field = detail.path.join('.');
        errors[field] = detail.message;
      });

      return sendError(res, 'Validation error', 400, errors);
    }

    req.validated = value;
    next();
  };
};

/**
 * Validate URL parameters using Joi schema
 * 
 * @param schema - Joi validation schema
 * @returns Middleware function
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach((detail) => {
        const field = detail.path.join('.');
        errors[field] = detail.message;
      });

      return sendError(res, 'Validation error', 400, errors);
    }

    req.validated = value;
    next();
  };
};
