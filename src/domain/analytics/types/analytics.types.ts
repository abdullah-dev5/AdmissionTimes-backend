/**
 * Analytics Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the analytics domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { AnalyticsEventType, UserType } from '@config/constants';

/**
 * Core analytics event record interface
 * Matches the database schema
 */
export interface AnalyticsEvent {
  id: string;
  event_type: AnalyticsEventType;
  entity_type: string | null; // e.g., "admission"
  entity_id: string | null;
  user_type: UserType | null; // Can be null for anonymous events
  user_id: string | null; // Future: foreign key to users
  metadata: Record<string, any> | null; // Minimal context
  created_at: string; // ISO8601 timestamp
}

/**
 * Create analytics event DTO
 * Used for tracking events
 */
export interface CreateAnalyticsEventDTO {
  event_type: AnalyticsEventType;
  entity_type?: string | null;
  entity_id?: string | null;
  user_type?: UserType | null;
  user_id?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Analytics event filter parameters
 * Used for filtering events
 */
export interface AnalyticsEventFilters {
  event_type?: AnalyticsEventType | AnalyticsEventType[];
  entity_type?: string;
  entity_id?: string;
  user_type?: UserType | UserType[];
  user_id?: string;
  date_from?: string; // ISO8601 date
  date_to?: string; // ISO8601 date
}

/**
 * Analytics query parameters
 * Combines filters with pagination and sorting
 */
export interface AnalyticsQueryParams extends AnalyticsEventFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * General statistics response
 */
export interface GeneralStatistics {
  total_events: number;
  total_admissions: number;
  total_users: number;
  events_by_type: Record<string, number>;
  events_today: number;
  events_this_week: number;
  events_this_month: number;
}

/**
 * Admission statistics response
 */
export interface AdmissionStatistics {
  total_admissions: number;
  admissions_by_status: Record<string, number>;
  admissions_by_type: Record<string, number>;
  admissions_created_today: number;
  admissions_created_this_week: number;
  admissions_created_this_month: number;
  verification_rate: number; // Percentage
  rejection_rate: number; // Percentage
}

/**
 * User statistics response
 */
export interface UserStatistics {
  total_users: number;
  users_by_role: Record<string, number>;
  active_users: number;
  suspended_users: number;
  users_created_today: number;
  users_created_this_week: number;
  users_created_this_month: number;
}

/**
 * Aggregated activity feed item
 */
export interface ActivityFeedItem {
  event_type: AnalyticsEventType;
  entity_type: string | null;
  entity_id: string | null;
  count: number;
  last_occurred_at: string; // ISO8601 timestamp
}
