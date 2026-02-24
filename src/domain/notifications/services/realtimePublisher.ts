/**
 * Realtime Publisher Service
 * 
 * Publishes notifications to Supabase Realtime channels for instant push delivery.
 * Uses channel pattern: notifications:user_{recipient_id}
 * 
 * Non-blocking: Failures are logged but don't throw to prevent
 * disrupting core notification creation flow.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '@config/config';
import type { Notification } from '@domain/notifications/types/notifications.types';

let supabaseClient: SupabaseClient | null = null;

/**
 * Initialize Supabase client on first use (lazy init)
 */
const getSupabaseClient = (): SupabaseClient | null => {
  if (!config.realtime.enabled) {
    console.log('[RealtimePublisher] Realtime disabled, skipping client initialization');
    return null;
  }

  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    console.warn('[RealtimePublisher] Missing Supabase credentials, realtime unavailable');
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        }
      );
      console.log('[RealtimePublisher] Supabase client initialized for realtime');
    } catch (error) {
      console.error('[RealtimePublisher] Failed to initialize Supabase client:', error);
      return null;
    }
  }

  return supabaseClient;
};

/**
 * Publish notification to user's realtime channel
 * Channel naming: notifications:user_{recipient_id}
 * 
 * @param notification - The notification to publish
 */
export const publishNotificationToChannel = async (notification: Notification): Promise<void> => {
  const client = getSupabaseClient();

  if (!client) {
    console.log('[RealtimePublisher] Skipping realtime publish - client not available');
    return;
  }

  if (!notification.recipient_id) {
    console.warn('[RealtimePublisher] Skipping realtime publish - no recipient_id');
    return;
  }

  try {
    const channelName = `notifications:user_${notification.recipient_id}`;

    // Publish to channel using Supabase Realtime broadcast
    const channel = client.channel(channelName);

    await channel.send({
      type: 'broadcast',
      event: 'notification_created',
      payload: {
        id: notification.id,
        type: notification.notification_type,
        message: notification.message,
        priority: notification.priority,
        related_entity_id: notification.related_entity_id,
        related_entity_type: notification.related_entity_type,
        action_url: notification.action_url,
        is_read: notification.is_read,
        created_at: notification.created_at,
      },
    });

    console.log('[RealtimePublisher] Notification published to realtime:', {
      notificationId: notification.id,
      recipientId: notification.recipient_id,
      channel: channelName,
      type: notification.notification_type,
    });

    // Clean up channel subscription
    await client.removeChannel(channel);
  } catch (error) {
    // Log but don't throw - realtime failures shouldn't block notification creation
    console.error('[RealtimePublisher] Failed to publish to realtime:', {
      error: error instanceof Error ? error.message : String(error),
      notificationId: notification.id,
      recipientId: notification.recipient_id,
    });
  }
};

/**
 * Gracefully disconnect client (call on app shutdown)
 */
export const disconnectClient = async (): Promise<void> => {
  if (supabaseClient) {
    await supabaseClient.removeAllChannels();
    supabaseClient = null;
    console.log('[RealtimePublisher] Supabase client disconnected');
  }
};
