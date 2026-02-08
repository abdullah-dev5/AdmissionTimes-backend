/**
 * Watchlists Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the watchlists domain.
 * These types ensure type safety across controllers, services, and models.
 */

/**
 * Core watchlist record interface
 * Matches the database schema
 */
export interface Watchlist {
  id: string;
  user_id: string;
  admission_id: string;
  notes: string | null;
  alert_opt_in: boolean;
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
}

/**
 * Watchlist with admission details (for responses)
 */
export interface WatchlistWithAdmission extends Watchlist {
  admission?: {
    id: string;
    title: string;
    field_of_study: string | null;
    university_id: string;
    status: string;
    created_at: string;
  };
}

/**
 * Create watchlist DTO
 * Used for adding admissions to watchlist
 */
export interface CreateWatchlistDTO {
  admission_id: string;
  notes?: string | null;
}

/**
 * Update watchlist DTO
 * Used for updating watchlist notes and alert settings
 */
export interface UpdateWatchlistDTO {
  notes?: string | null;
  alert_opt_in?: boolean;
}

/**
 * Watchlist filter parameters
 * Used for filtering watchlists
 */
export interface WatchlistFilters {
  user_id: string; // Required - users can only see their own watchlists
  admission_id?: string;
}

/**
 * Watchlist query parameters
 * Combines filters with pagination and sorting
 */
export interface WatchlistQueryParams extends WatchlistFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
