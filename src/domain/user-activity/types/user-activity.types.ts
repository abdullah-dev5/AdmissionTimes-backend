/**
 * User Activity Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the user activity domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { ActivityType, UserType } from '@config/constants';

/**
 * Core user activity record interface
 * Matches the database schema
 */
export interface UserActivity {
  id: string;
  user_id: string | null;
  user_type: UserType;
  activity_type: ActivityType;
  entity_type: string; // e.g., "admission"
  entity_id: string;
  metadata: Record<string, any> | null; // JSONB
  created_at: string; // ISO8601 timestamp
}

/**
 * Create user activity DTO
 * Used for creating new activity records
 */
export interface CreateUserActivityDTO {
  user_id?: string | null;
  user_type: UserType;
  activity_type: ActivityType;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, any> | null;
}

/**
 * User activity filter parameters
 * Used for filtering activities
 */
export interface UserActivityFilters {
  user_id?: string | null;
  user_type?: UserType;
  activity_type?: ActivityType;
  entity_type?: string;
  entity_id?: string;
}

/**
 * User activity query parameters
 * Combines filters with pagination and sorting
 */
export interface UserActivityQueryParams extends UserActivityFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * User context interface
 * Attached to requests by auth middleware
 */
export interface UserContext {
  id: string | null;
  role: 'student' | 'university' | 'admin' | 'guest';
  university_id?: string | null;
}
