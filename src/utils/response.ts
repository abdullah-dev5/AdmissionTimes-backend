/**
 * Response utility functions
 * 
 * Provides standardized response formatting for API endpoints.
 */

import { Response } from 'express';

/**
 * Standard success response format
 * 
 * @param res - Express response object
 * @param data - Response data
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 */
export const sendSuccess = (
  res: Response,
  data: any = null,
  message: string = 'Success',
  statusCode: number = 200
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Standard error response format
 * 
 * @param res - Express response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 400)
 * @param errors - Additional error details (optional)
 */
export const sendError = (
  res: Response,
  message: string = 'An error occurred',
  statusCode: number = 400,
  errors: any = null
): void => {
  const response: any = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
};

/**
 * Paginated response format
 * 
 * @param res - Express response object
 * @param data - Array of data items
 * @param pagination - Pagination metadata
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 */
export const sendPaginated = (
  res: Response,
  data: any[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  },
  message: string = 'Success',
  statusCode: number = 200
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
    timestamp: new Date().toISOString(),
  });
};
