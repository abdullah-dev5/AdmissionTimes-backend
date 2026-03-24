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
import { NOTIFICATION_TYPE } from '@config/constants';
import { sendNotificationEmail } from './emailDelivery';
import { publishNotificationToChannel } from './realtimePublisher';
import { getUserNotificationPreferences } from './userUtils';
import {
  registerUserPushToken,
  unregisterUserPushToken,
  sendPushNotificationToUser,
} from './pushDelivery';

interface EmailLogFilters {
  status?: 'sent' | 'failed';
  limit?: number;
}

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
    if (userContext.id && notification.recipient_id && notification.recipient_id !== userContext.id) {
      throw new AppError('Notification not found', 404);
    }
    if (notification.role_type !== userContext.role) {
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

  console.log(`📊 [FETCH] Getting notifications with filters:`, {
    recipient_id: effectiveFilters.recipient_id,
    role_type: effectiveFilters.role_type,
    notification_type: effectiveFilters.notification_type,
    page,
    limit,
    sort,
    order,
  });

  // Get notifications and total count
  const [notifications, total] = await Promise.all([
    notificationsModel.findMany(effectiveFilters, page, limit, sort, order),
    notificationsModel.count(effectiveFilters),
  ]);

  console.log(`📊 [FETCH] Found ${notifications.length} notifications (total: ${total})`);

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

  if (!data.notification_type) {
    throw new AppError('Notification type is required', 400);
  }

  if (!data.role_type) {
    throw new AppError('Role type is required', 400);
  }

  if (!data.recipient_id) {
    console.error('❌ [SERVICE] Recipient ID is required for notification:', {
      notification_type: data.notification_type,
      event_key: data.event_key,
    });
    throw new AppError('Recipient ID is required', 400);
  }

  if (!data.event_key) {
    throw new AppError('Event key is required', 400);
  }

  try {
    const result = await notificationsModel.create(data);
    const wasExisting = (result as Notification & { __existing?: boolean }).__existing === true;

    if (wasExisting) {
      console.log(`⏭️ [SERVICE] Duplicate notification suppressed, skipping side-effects for event_key=${data.event_key}`);
      return result;
    }

    if (data.recipient_id) {
      getUserNotificationPreferences(data.recipient_id)
        .then((preferences) => {
          const category = inferNotificationCategory(data.notification_type);
          const categoryEnabled = preferences.categories[category] !== false;
          const forceEmailForDeadlineReminder = data.notification_type === NOTIFICATION_TYPE.DEADLINE_NEAR;

          if (preferences.email && (preferences.emailEnabled || forceEmailForDeadlineReminder) && categoryEnabled) {
            sendNotificationEmail(result, preferences.email).catch((emailError) => {
              console.error('[NotificationService] Email delivery failed (non-blocking):', emailError);
            });
          }

          sendPushNotificationToUser(result, {
            pushEnabled: preferences.pushEnabled,
            categoryEnabled,
          }).catch((pushError) => {
            console.error('[NotificationService] Push delivery failed (non-blocking):', pushError);
          });
        })
        .catch((error) => {
          console.error('[NotificationService] Preference lookup failed (non-blocking):', error);
        });
    }

    // Phase 2: Non-blocking realtime publish
    publishNotificationToChannel(result).catch((error) => {
      console.error('[NotificationService] Realtime publish failed (non-blocking):', error);
    });

    return result;
  } catch (error: any) {
    console.error('❌ [SERVICE] Failed to create notification:', {
      error: error?.message || String(error),
      data: {
        recipient_id: data.recipient_id,
        notification_type: data.notification_type,
        event_key: data.event_key,
      },
    });
    throw error;
  }
};

export const registerPushToken = async (
  userContext: UserContext | undefined,
  input: {
    expo_push_token: string;
    platform?: 'ios' | 'android' | 'web' | 'unknown';
    device_id?: string | null;
    app_version?: string | null;
  }
) => {
  if (!userContext?.id) {
    throw new AppError('User context required', 401);
  }

  return registerUserPushToken({
    userId: userContext.id,
    expoPushToken: input.expo_push_token,
    platform: input.platform,
    deviceId: input.device_id,
    appVersion: input.app_version,
  });
};

export const unregisterPushToken = async (
  userContext: UserContext | undefined,
  input: {
    expo_push_token: string;
  }
): Promise<number> => {
  if (!userContext?.id) {
    throw new AppError('User context required', 401);
  }

  return unregisterUserPushToken(userContext.id, input.expo_push_token);
};

export const getEmailDeliveryLogs = async (filters: EmailLogFilters = {}): Promise<any[]> => {
  return notificationsModel.findEmailDeliveryLogs(filters);
};

export const replayEmailFromLog = async (
  logId: string,
  userContext?: UserContext
): Promise<{ log_id: string; notification_id: string; recipient_email: string; replayed: boolean }> => {
  if (!userContext || userContext.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const log = await notificationsModel.findEmailDeliveryLogById(logId);
  if (!log) {
    throw new AppError('Email delivery log not found', 404);
  }

  const notification = await notificationsModel.findById(log.notification_id);
  if (!notification) {
    throw new AppError('Notification not found for email log', 404);
  }

  await sendNotificationEmail(notification, log.recipient_email);

  return {
    log_id: log.id,
    notification_id: log.notification_id,
    recipient_email: log.recipient_email,
    replayed: true,
  };
};

export const replayEmailByNotificationId = async (
  notificationId: string,
  userContext?: UserContext
): Promise<{ notification_id: string; recipient_email: string; replayed: boolean }> => {
  if (!userContext || userContext.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const notification = await notificationsModel.findById(notificationId);
  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  if (!notification.recipient_id) {
    throw new AppError('Notification has no recipient', 400);
  }

  const preferences = await getUserNotificationPreferences(notification.recipient_id);
  if (!preferences.email) {
    throw new AppError('Recipient email not available', 400);
  }

  await sendNotificationEmail(notification, preferences.email);

  return {
    notification_id: notification.id,
    recipient_email: preferences.email,
    replayed: true,
  };
};

export const cleanupManualReminderTestNotifications = async (
  userContext?: UserContext
): Promise<{ deleted_count: number }> => {
  if (!userContext || userContext.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }

  const deletedCount = await notificationsModel.deleteManualTestDeadlineNotifications();
  return { deleted_count: deletedCount };
};

const inferNotificationCategory = (notificationType: string): 'verification' | 'deadline' | 'system' | 'update' => {
  if (notificationType === NOTIFICATION_TYPE.DEADLINE_NEAR) return 'deadline';
  if (
    notificationType === NOTIFICATION_TYPE.ADMISSION_VERIFIED ||
    notificationType === NOTIFICATION_TYPE.ADMISSION_REJECTED ||
    notificationType === NOTIFICATION_TYPE.ADMISSION_REVISION_REQUIRED
  ) {
    return 'verification';
  }
  if (
    notificationType === NOTIFICATION_TYPE.SYSTEM_BROADCAST ||
    notificationType === NOTIFICATION_TYPE.SYSTEM_ERROR
  ) {
    return 'system';
  }
  return 'update';
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

  if (!userContext.id) {
    throw new AppError('User ID required', 401);
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

  if (!userContext.id) {
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
    effectiveFilters.recipient_id = userContext.id;
    effectiveFilters.role_type = userContext.role as any;
  }

  return effectiveFilters;
}
