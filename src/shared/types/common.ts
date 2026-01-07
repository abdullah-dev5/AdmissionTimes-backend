/**
 * Common TypeScript types used across the application
 */

/**
 * Standard API response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any;
  timestamp: string;
}

/**
 * Paginated API response structure
 */
export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  message: string;
  errors?: {
    field?: string;
    message: string;
  }[];
  timestamp: string;
}
