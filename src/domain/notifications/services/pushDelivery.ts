import { config } from '@config/config';
import { NOTIFICATION_TYPE } from '@config/constants';
import { query } from '@db/connection';
import type { Notification } from '@domain/notifications/types/notifications.types';
import crypto from 'crypto';
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

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const logPushDelivery = async (input: {
  notificationId?: string | null;
  recipientId?: string | null;
  token?: string | null;
  ticketStatus: string;
  ticketId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  httpStatus?: number | null;
  providerResponse?: unknown;
}) => {
  try {
    await query(
      `
        INSERT INTO push_delivery_logs (
          notification_id,
          recipient_id,
          token_hash,
          channel,
          ticket_status,
          ticket_id,
          error_code,
          error_message,
          http_status,
          provider_response
        )
        VALUES ($1::uuid, $2::uuid, $3, 'expo', $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        input.notificationId || null,
        input.recipientId || null,
        input.token ? hashToken(input.token) : null,
        input.ticketStatus,
        input.ticketId || null,
        input.errorCode || null,
        input.errorMessage || null,
        input.httpStatus ?? null,
        input.providerResponse ? JSON.stringify(input.providerResponse) : null,
      ]
    );
  } catch (error) {
    console.error('[PushDelivery] Failed to persist push delivery log:', error);
  }
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
  let tokens: string[] = [];

  if (config.env === 'test') {
    return;
  }

  if (config.push.enabled === false) {
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
    tokens = await listActivePushTokensForUser(notification.recipient_id);

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

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[PushDelivery] Expo push request failed:', response.status, responseText);
      for (const token of tokens) {
        await logPushDelivery({
          notificationId: notification.id,
          recipientId: notification.recipient_id,
          token,
          ticketStatus: 'http_error',
          errorMessage: responseText?.slice(0, 1000) || 'HTTP error from Expo push endpoint',
          httpStatus: response.status,
          providerResponse: { responseText },
        });
      }
      return;
    }

    let parsed: any = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch {
      parsed = null;
    }

    const tickets = Array.isArray(parsed?.data) ? parsed.data : [];

    if (tickets.length === 0) {
      for (const token of tokens) {
        await logPushDelivery({
          notificationId: notification.id,
          recipientId: notification.recipient_id,
          token,
          ticketStatus: 'unknown',
          errorMessage: 'Expo response did not include push tickets',
          httpStatus: response.status,
          providerResponse: parsed || responseText,
        });
      }
      return;
    }

    for (let i = 0; i < tickets.length; i += 1) {
      const ticket = tickets[i];
      const targetToken = tokens[i];
      const detailsError = String(ticket?.details?.error || '');
      const ticketMessage = String(ticket?.message || '');

      await logPushDelivery({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        token: targetToken,
        ticketStatus: String(ticket?.status || 'unknown'),
        ticketId: ticket?.id ? String(ticket.id) : null,
        errorCode: detailsError || null,
        errorMessage: ticketMessage || null,
        httpStatus: response.status,
        providerResponse: ticket,
      });

      if (ticket?.status === 'error' && (detailsError === 'DeviceNotRegistered' || ticketMessage.includes('DeviceNotRegistered'))) {
        try {
          await deactivatePushTokenForUser(notification.recipient_id, targetToken);
          console.warn('[PushDelivery] Deactivated invalid Expo token for user:', notification.recipient_id);
        } catch (deactivateError) {
          console.error('[PushDelivery] Failed to deactivate invalid token:', deactivateError);
        }
      }
    }
  } catch (error) {
    console.error('[PushDelivery] Failed to send push notification:', error);
    for (const token of tokens) {
      await logPushDelivery({
        notificationId: notification.id,
        recipientId: notification.recipient_id,
        token,
        ticketStatus: 'exception',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
};
