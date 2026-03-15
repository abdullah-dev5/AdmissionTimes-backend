/**
 * Notification Publisher
 *
 * Centralized entry point for creating notifications from domain events.
 * Ensures all notifications are traceable to a semantic event key.
 */

import { create } from './notifications.service';
import { NotificationPriority, NotificationType, UserType } from '@config/constants';

export interface NotificationRecipient {
  id: string;
  role: UserType;
}

export interface PublishNotificationInput {
  recipients: NotificationRecipient[];
  notification_type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  action_url?: string | null;
  event_key: string;
}

export const publishNotification = async (input: PublishNotificationInput) => {
  const {
    recipients,
    notification_type,
    priority,
    title,
    message,
    related_entity_type,
    related_entity_id,
    action_url,
    event_key,
  } = input;

  console.log(`📨 [PUBLISHER] publishNotification() called with:
   notification_type: ${notification_type}
   recipients count: ${recipients.length}
   recipients: [${recipients.map(r => `${r.role}(${r.id.substring(0,8)}...)`).join(', ')}]
   event_key: ${event_key}`);

  if (!recipients.length) {
    console.log(`📨 [PUBLISHER] No recipients provided, returning empty array`);
    return [];
  }

  console.log(`📨 [PUBLISHER] Creating ${recipients.length} notifications...`);
  
  // Create notifications sequentially with detailed error logging
  const results: any[] = [];
  let createdCount = 0;
  let dedupedCount = 0;
  for (const recipient of recipients) {
    try {
      console.log(`   → Creating for ${recipient.role} (${recipient.id.substring(0,8)}...)`);
      const result = await create({
        recipient_id: recipient.id,
        role_type: recipient.role,
        notification_type,
        priority,
        title,
        message,
        related_entity_type,
        related_entity_id,
        action_url,
        event_key,
      });
      results.push(result);

      const wasExisting = (result as { __existing?: boolean } | null)?.__existing === true;

      if (wasExisting) {
        dedupedCount += 1;
        console.log(`   ⏭️ Deduped existing notification for ${recipient.role} (${recipient.id})`);
      } else {
        createdCount += 1;
        console.log(`   ✅ Created notification for ${recipient.role} (${recipient.id})`);
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to create notification for ${recipient.role} (${recipient.id}):`, {
        error: error?.message || String(error),
        recipient_id: recipient.id,
        recipient_role: recipient.role,
      });
      // Continue with other recipients even if one fails
      results.push(null);
    }
  }

  const successCount = results.filter(r => r !== null).length;
  console.log(`📨 [PUBLISHER] Completed. total_success=${successCount}/${recipients.length}, created=${createdCount}, deduped=${dedupedCount}`);
  return results;
};
