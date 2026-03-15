/**
 * Deadlines Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the deadlines domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { DeadlineType } from '@config/constants';

/**
 * Core deadline record interface
 * Matches the database schema
 */
export interface Deadline {
  id: string;
  admission_id: string;
  deadline_type: DeadlineType;
  deadline_date: string; // ISO8601 timestamp
  timezone: string;
  is_flexible: boolean;
  reminder_sent: boolean;
  reminder_sent_7d_at?: string | null;
  reminder_sent_3d_at?: string | null;
  reminder_sent_1d_at?: string | null;
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
}

/**
 * Deadline with calculated fields
 * Extended deadline with computed urgency and days remaining
 */
export interface DeadlineWithMetadata extends Deadline {
  days_remaining: number;
  is_overdue: boolean;
  urgency_level: 'low' | 'medium' | 'high' | 'critical' | 'expired';
}

/**
 * Create deadline DTO
 * Used for creating new deadlines
 */
export interface CreateDeadlineDTO {
  admission_id: string;
  deadline_type: DeadlineType;
  deadline_date: string; // ISO8601
  timezone?: string;
  is_flexible?: boolean;
}

/**
 * Update deadline DTO
 * All fields optional for partial updates
 */
export interface UpdateDeadlineDTO {
  deadline_type?: DeadlineType;
  deadline_date?: string; // ISO8601
  timezone?: string;
  is_flexible?: boolean;
  reminder_sent?: boolean;
  reminder_sent_7d_at?: string | null;
  reminder_sent_3d_at?: string | null;
  reminder_sent_1d_at?: string | null;
}

/**
 * Deadline filter parameters
 * Used for filtering deadlines
 */
export interface DeadlineFilters {
  admission_id?: string;
  deadline_type?: DeadlineType;
  is_overdue?: boolean;
  is_upcoming?: boolean;
  date_from?: string; // ISO8601
  date_to?: string; // ISO8601
}

/**
 * Deadline query parameters
 * Combines filters with pagination and sorting
 */
export interface DeadlineQueryParams extends DeadlineFilters {
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
