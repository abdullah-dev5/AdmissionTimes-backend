/**
 * Pagination utilities
 * 
 * Helper functions for handling pagination in API responses.
 */

import { PAGINATION } from '../../config/constants';

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Pagination result interface
 */
export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Parse and validate pagination parameters
 * 
 * @param params - Raw pagination parameters from request
 * @returns Validated pagination parameters
 */
export const parsePagination = (params: PaginationParams): { page: number; limit: number } => {
  const page = Math.max(1, parseInt(String(params.page || PAGINATION.DEFAULT_PAGE), 10));
  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(String(params.limit || PAGINATION.DEFAULT_LIMIT), 10))
  );

  return { page, limit };
};

/**
 * Calculate pagination metadata
 * 
 * @param total - Total number of items
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Pagination result object
 */
export const calculatePagination = (
  total: number,
  page: number,
  limit: number
): PaginationResult => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };
};

/**
 * Calculate offset for database queries
 * 
 * @param page - Current page number
 * @param limit - Items per page
 * @returns Offset value
 */
export const calculateOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};
