/**
 * Notifications Domain - Service Layer
 * 
 * Business logic and orchestration for notifications.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Create notifications
 * - Coordinate between model and other services
 * - Validate business rules
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import * as notificationsModel from '../models/notifications.model';
import {
  Notification,
  CreateNotificationDTO,
  NotificationFilters,
  UserContext,
} from '../types/notifications.types';

/**
 * Get notification by ID
 * 
 * @param id - Notification UUID
 * @param userContext - User context (for access control)
 * @returns Notification record
 * @throws AppError if not found or access denied
 */
export const getById = async (
  id: string,
  userContext?: UserContext
): Promise<Notification> => {
  const notification = await notificationsModel.findById(id);

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  // Access control: users can only see their own notifications
  if (userContext) {
    if (userContext.id && notification.user_id && notification.user_id !== userContext.id) {
      throw new AppError('Notification not found', 404);
    }
    if (notification.user_type !== userContext.role) {
      throw new AppError('Notification not found', 404);
    }
  }

  return notification;
};

/**
 * Get multiple notifications with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @param userContext - User context (for access control)
 * @returns Object with notifications array and total count
 */
export const getMany = async (
  filters: NotificationFilters,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc',
  userContext?: UserContext
): Promise<{ notifications: Notification[]; total: number }> => {
  // Apply access control filters
  const effectiveFilters = applyAccessControl(filters, userContext);

  // Get notifications and total count
  const [notifications, total] = await Promise.all([
    notificationsModel.findMany(effectiveFilters, page, limit, sort, order),
    notificationsModel.count(effectiveFilters),
  ]);

  return { notifications, total };
};

/**
 * Create a new notification
 * 
 * @param data - Notification data
 * @returns Created notification record
 */
export const create = async (data: CreateNotificationDTO): Promise<Notification> => {
  // Validate required fields
  if (!data.title || !data.message) {
    throw new AppError('Title and message are required', 400);
  }

  if (!data.category) {
    throw new AppError('Category is required', 400);
  }

  if (!data.user_type) {
    throw new AppError('User type is required', 400);
  }

  return await notificationsModel.create(data);
};

/**
 * Mark notification as read
 * 
 * @param id - Notification UUID
 * @param userContext - User context (for access control)
 * @param readAt - Optional read timestamp
 * @returns Updated notification record
 * @throws AppError if not found or access denied
 */
export const markAsRead = async (
  id: string,
  userContext?: UserContext,
  readAt?: string
): Promise<Notification> => {
  // First verify access
  await getById(id, userContext);

  const notification = await notificationsModel.markAsRead(id, readAt || null);

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  return notification;
};

/**
 * Mark all notifications as read for a user
 * 
 * @param userContext - User context
 * @returns Number of notifications marked as read
 */
export const markAllAsRead = async (userContext?: UserContext): Promise<number> => {
  if (!userContext) {
    throw new AppError('User context required', 401);
  }

  return await notificationsModel.markAllAsRead(
    userContext.id,
    userContext.role
  );
};

/**
 * Get unread count for a user
 * 
 * @param userContext - User context
 * @returns Unread notification count
 */
export const getUnreadCount = async (userContext?: UserContext): Promise<number> => {
  if (!userContext) {
    return 0;
  }

  return await notificationsModel.getUnreadCount(userContext.id, userContext.role);
};

/**
 * Delete a notification
 * 
 * @param id - Notification UUID
 * @param userContext - User context (for access control)
 * @returns True if deleted
 * @throws AppError if not found or access denied
 */
export const deleteById = async (
  id: string,
  userContext?: UserContext
): Promise<boolean> => {
  // First verify access
  await getById(id, userContext);

  return await notificationsModel.deleteById(id);
};

/**
 * Apply access control filters based on user context
 * 
 * @param filters - Original filters
 * @param userContext - User context
 * @returns Filters with access control applied
 */
function applyAccessControl(
  filters: NotificationFilters,
  userContext?: UserContext
): NotificationFilters {
  const effectiveFilters = { ...filters };

  // If user context exists, filter by user
  if (userContext) {
    effectiveFilters.user_id = userContext.id;
    effectiveFilters.user_type = userContext.role as any;
  }

  return effectiveFilters;
}
