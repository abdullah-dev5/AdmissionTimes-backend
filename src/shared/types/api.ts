/**
 * API-specific types
 */

import { ApiResponse, PaginatedResponse } from './common';

/**
 * Request query parameters for filtering
 */
export interface FilterParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  [key: string]: any;
}

/**
 * Standard list response type
 */
export type ListResponse<T> = PaginatedResponse<T>;

/**
 * Standard detail response type
 */
export type DetailResponse<T> = ApiResponse<T>;

/**
 * Standard create response type
 */
export type CreateResponse<T> = ApiResponse<T>;

/**
 * Standard update response type
 */
export type UpdateResponse<T> = ApiResponse<T>;

/**
 * Standard delete response type
 */
export type DeleteResponse = ApiResponse<null>;
