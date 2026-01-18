/**
 * Analytics Domain - Service Layer
 * 
 * Business logic and orchestration for analytics.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Aggregate statistics
 * - Coordinate between model and other services
 * - Validate business rules
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as analyticsModel from '../models/analytics.model';
import {
  AnalyticsEvent,
  CreateAnalyticsEventDTO,
  AnalyticsEventFilters,
  GeneralStatistics,
  AdmissionStatistics,
  UserStatistics,
  ActivityFeedItem,
} from '../types/analytics.types';

/**
 * Track an analytics event
 * 
 * @param data - Event data
 * @returns Created event record
 */
export const trackEvent = async (data: CreateAnalyticsEventDTO): Promise<AnalyticsEvent> => {
  // Validate required fields
  if (!data.event_type) {
    throw new AppError('Event type is required', 400);
  }

  return await analyticsModel.create(data);
};

/**
 * Get general statistics
 * 
 * @returns General statistics object
 */
export const getGeneralStatistics = async (): Promise<GeneralStatistics> => {
  const [stats, eventsByType] = await Promise.all([
    analyticsModel.getGeneralStatistics(),
    analyticsModel.getEventsByType(),
  ]);

  return {
    total_events: parseInt(stats.total_events || '0', 10),
    total_admissions: parseInt(stats.total_admissions || '0', 10),
    total_users: parseInt(stats.total_users || '0', 10),
    events_by_type: eventsByType,
    events_today: parseInt(stats.events_today || '0', 10),
    events_this_week: parseInt(stats.events_this_week || '0', 10),
    events_this_month: parseInt(stats.events_this_month || '0', 10),
  };
};

/**
 * Get admission statistics
 * 
 * @returns Admission statistics object
 */
export const getAdmissionStatistics = async (): Promise<AdmissionStatistics> => {
  const stats = await analyticsModel.getAdmissionStatistics();

  const total = parseInt(stats.total_admissions || '0', 10);
  const verified = parseInt(stats.verified_count || '0', 10);
  const rejected = parseInt(stats.rejected_count || '0', 10);

  return {
    total_admissions: total,
    admissions_by_status: {
      verified: verified,
      rejected: rejected,
      pending: parseInt(stats.pending_count || '0', 10),
      draft: parseInt(stats.draft_count || '0', 10),
    },
    admissions_by_type: {}, // Can be enhanced later with program_type aggregation
    admissions_created_today: parseInt(stats.created_today || '0', 10),
    admissions_created_this_week: parseInt(stats.created_this_week || '0', 10),
    admissions_created_this_month: parseInt(stats.created_this_month || '0', 10),
    verification_rate: total > 0 ? (verified / total) * 100 : 0,
    rejection_rate: total > 0 ? (rejected / total) * 100 : 0,
  };
};

/**
 * Get user statistics
 * 
 * @returns User statistics object
 */
export const getUserStatistics = async (): Promise<UserStatistics> => {
  const [stats, usersByRole] = await Promise.all([
    analyticsModel.getUserStatistics(),
    analyticsModel.getUsersByRole(),
  ]);

  return {
    total_users: parseInt(stats.total_users || '0', 10),
    users_by_role: usersByRole,
    active_users: parseInt(stats.active_users || '0', 10),
    suspended_users: parseInt(stats.suspended_users || '0', 10),
    users_created_today: parseInt(stats.created_today || '0', 10),
    users_created_this_week: parseInt(stats.created_this_week || '0', 10),
    users_created_this_month: parseInt(stats.created_this_month || '0', 10),
  };
};

/**
 * Get aggregated activity feed
 * 
 * @param limit - Maximum number of items to return
 * @returns Array of aggregated activity items
 */
export const getActivityFeed = async (limit: number = 20): Promise<ActivityFeedItem[]> => {
  const feed = await analyticsModel.getActivityFeed(limit);

  return feed.map((item: any) => ({
    event_type: item.event_type,
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    count: parseInt(item.count, 10),
    last_occurred_at: item.last_occurred_at,
  }));
};

/**
 * Get multiple events with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @returns Object with events array and total count
 */
export const getEvents = async (
  filters: AnalyticsEventFilters,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc'
): Promise<{ events: AnalyticsEvent[]; total: number }> => {
  // Get events and total count
  const [events, total] = await Promise.all([
    analyticsModel.findMany(filters, page, limit, sort, order),
    analyticsModel.count(filters),
  ]);

  return { events, total };
};
