import { config } from '@config/config';
import { NOTIFICATION_TYPE } from '@config/constants';
import type { Notification } from '@domain/notifications/types/notifications.types';
import {
  upsertPushToken,
  listActivePushTokensForUser,
  deactivatePushTokenForUser,
} from '../models/push-tokens.model';

interface RegisterPushTokenInput {
  userId: string;
  expoPushToken: string;
  platform?: 'ios' | 'android' | 'web' | 'unknown';
  deviceId?: string | null;
  appVersion?: string | null;
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

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

export const registerUserPushToken = async (input: RegisterPushTokenInput) => {
  return upsertPushToken({
    userId: input.userId,
    expoPushToken: input.expoPushToken,
    platform: input.platform,
    deviceId: input.deviceId,
    appVersion: input.appVersion,
  });
};

export const unregisterUserPushToken = async (userId: string, expoPushToken: string): Promise<number> => {
  return deactivatePushTokenForUser(userId, expoPushToken);
};

export const sendPushNotificationToUser = async (
  notification: Notification,
  options?: {
    pushEnabled?: boolean;
    categoryEnabled?: boolean;
  }
): Promise<void> => {
  if (config.env === 'test') {
    return;
  }

  if (config.realtime.enabled === false) {
    return;
  }

  if (!notification.recipient_id) {
    return;
  }

  const category = inferNotificationCategory(notification.notification_type);
  if (options?.pushEnabled === false) {
    return;
  }
  if (options?.categoryEnabled === false) {
    return;
  }

  try {
    const tokens = await listActivePushTokensForUser(notification.recipient_id);

    if (!tokens.length) {
      return;
    }

    const messages = tokens.map((token) => ({
      to: token,
      title: notification.title,
      body: notification.message,
      sound: 'default',
      data: {
        notification_id: notification.id,
        notification_type: notification.notification_type,
        category,
        related_entity_id: notification.related_entity_id,
        related_entity_type: notification.related_entity_type,
      },
      priority: notification.priority === 'urgent' || notification.priority === 'high' ? 'high' : 'default',
    }));

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('[PushDelivery] Expo push request failed:', response.status, responseText);
    }
  } catch (error) {
    console.error('[PushDelivery] Failed to send push notification:', error);
  }
};
