/**
 * Notifications Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the notifications domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { NotificationPriority, NotificationType, UserType } from '@config/constants';

/**
 * Core notification record interface
 * Matches the database schema
 */
export interface Notification {
  id: string;
  recipient_id: string | null;
  role_type: UserType;
  notification_type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  related_entity_type: string | null; // e.g., "admission", "verification"
  related_entity_id: string | null; // e.g., admission_id
  is_read: boolean;
  read_at: string | null; // ISO8601 timestamp
  action_url: string | null; // Frontend route
  event_key: string;
  created_at: string; // ISO8601 timestamp
  university_name?: string | null;
}

/**
 * Create notification DTO
 * Used for creating new notifications
 */
export interface CreateNotificationDTO {
  recipient_id?: string | null;
  role_type: UserType;
  notification_type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  action_url?: string | null;
  event_key: string;
}

/**
 * Notification filter parameters
 * Used for filtering notifications
 */
export interface NotificationFilters {
  recipient_id?: string | null;
  role_type?: UserType;
  notification_type?: NotificationType;
  priority?: NotificationPriority;
  is_read?: boolean;
  related_entity_type?: string;
  related_entity_id?: string;
}

/**
 * Notification query parameters
 * Combines filters with pagination and sorting
 */
export interface NotificationQueryParams extends NotificationFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Mark notification as read DTO
 */
export interface MarkReadDTO {
  read_at?: string; // Optional, defaults to now
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
