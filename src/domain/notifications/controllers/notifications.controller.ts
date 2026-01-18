/**
 * Notifications Domain - Controller Layer
 * 
 * HTTP request/response handlers for notifications endpoints.
 * 
 * Responsibilities:
 * - Extract request data (body, params, query)
 * - Call service methods
 * - Format responses using sendSuccess(), sendError(), sendPaginated()
 * - Set appropriate HTTP status codes
 * - Handle async errors with try-catch
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import * as notificationsService from '../services/notifications.service';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import {
  NotificationQueryParams,
  UserContext,
} from '../types/notifications.types';

/**
 * Get single notification by ID
 * 
 * GET /api/v1/notifications/:id
 */
export const getNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContext | undefined;

    const notification = await notificationsService.getById(id, userContext);

    sendSuccess(res, notification, 'Notification retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple notifications with filters and pagination
 * 
 * GET /api/v1/notifications
 */
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as NotificationQueryParams;
    const userContext = req.user as UserContext | undefined;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract filters
    const filters = {
      user_id: queryParams.user_id,
      user_type: queryParams.user_type,
      category: queryParams.category,
      priority: queryParams.priority,
      is_read: queryParams.is_read,
      related_entity_type: queryParams.related_entity_type,
      related_entity_id: queryParams.related_entity_id,
    };

    // Extract sort and order
    const sort = queryParams.sort || 'created_at';
    const order = queryParams.order || 'desc';

    // Get notifications
    const { notifications, total } = await notificationsService.getMany(
      filters,
      page,
      limit,
      sort,
      order,
      userContext
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, notifications, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Mark notification as read
 * 
 * PATCH /api/v1/notifications/:id/read
 */
export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as { read_at?: string };
    const userContext = req.user as UserContext | undefined;

    const notification = await notificationsService.markAsRead(
      id,
      userContext,
      data.read_at
    );

    sendSuccess(res, notification, 'Notification marked as read');
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * 
 * PATCH /api/v1/notifications/read-all
 */
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    const count = await notificationsService.markAllAsRead(userContext);

    sendSuccess(res, { count }, `${count} notifications marked as read`);
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread count
 * 
 * GET /api/v1/notifications/unread-count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userContext = req.user as UserContext | undefined;

    const count = await notificationsService.getUnreadCount(userContext);

    sendSuccess(res, { count }, 'Unread count retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new notification
 * 
 * POST /api/v1/notifications
 */
export const createNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as any;

    const notification = await notificationsService.create(data);

    sendSuccess(res, notification, 'Notification created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 * 
 * DELETE /api/v1/notifications/:id
 */
export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContext | undefined;

    await notificationsService.deleteById(id, userContext);

    sendSuccess(res, null, 'Notification deleted successfully');
  } catch (error) {
    next(error);
  }
};
