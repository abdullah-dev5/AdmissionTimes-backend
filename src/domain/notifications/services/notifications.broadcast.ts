import { AppError } from '@shared/middleware/errorHandler';
import { publishNotification } from './notificationPublisher';
import { NOTIFICATION_TYPE, NOTIFICATION_PRIORITY, NotificationPriority, UserType } from '@config/constants';
import type { UserContext } from '../types/notifications.types';
import { query } from '@db/connection';

export enum BroadcastTargetType {
  ALL_USERS = 'all',
  ROLE_SPECIFIC = 'role',
  MAINTENANCE_ALERT = 'maintenance',
  EMERGENCY = 'emergency',
}

export interface BroadcastPayload {
  target_type: BroadcastTargetType;
  target_roles?: string[];
  title: string;
  message: string;
  priority?: NotificationPriority;
  action_url?: string;
}

export interface BroadcastResult {
  recipients_count: number;
  success: boolean;
  created_count: number;
}

/**
 * Get all users with a specific role
 */
async function getUsersByRole(role: string): Promise<Array<{ id: string; role: UserType }>> {
  const result = await query('SELECT id::text as id, role FROM users WHERE role = $1', [role]);
  console.log(`🔍 [BROADCAST] getUsersByRole('${role}'): Found ${result.rows.length} users`);
  if (result.rows.length > 0) {
    result.rows.forEach(r => console.log(`   - ${r.role}: ${r.id.substring(0, 8)}...`));
  }
  return result.rows.map((row) => ({ id: row.id, role: row.role as UserType }));
}

/**
 * Get all active users
 */
async function getAllUsers(): Promise<Array<{ id: string; role: UserType }>> {
  const result = await query('SELECT id::text as id, role FROM users', []);
  console.log(`🔍 [BROADCAST] getAllUsers(): Found ${result.rows.length} total users`);
  result.rows.forEach(r => console.log(`   - ${r.role.padEnd(12)}: ${r.id.substring(0, 8)}...`));
  return result.rows.map((row) => ({ id: row.id, role: row.role as UserType }));
}

/**
 * Expand broadcast target to list of recipients
 */
async function expandRecipients(payload: BroadcastPayload): Promise<Array<{ id: string; role: UserType }>> {
  switch (payload.target_type) {
    case BroadcastTargetType.ALL_USERS:
    case BroadcastTargetType.MAINTENANCE_ALERT:
    case BroadcastTargetType.EMERGENCY:
      const allUsers = await getAllUsers();
      console.log(`📢 [BROADCAST] Expanded target type '${payload.target_type}' to ${allUsers.length} users`);
      return allUsers;

    case BroadcastTargetType.ROLE_SPECIFIC:
      if (!payload.target_roles || payload.target_roles.length === 0) {
        throw new AppError('target_roles required for role-specific broadcast', 400);
      }
      const recipients: Array<{ id: string; role: UserType }> = [];
      for (const role of payload.target_roles) {
        const users = await getUsersByRole(role);
        recipients.push(...users);
      }
      console.log(`📢 [BROADCAST] Expanded target roles ${JSON.stringify(payload.target_roles)} to ${recipients.length} users`);
      return recipients;

    default:
      throw new AppError(`Unknown broadcast target type: ${payload.target_type}`, 400);
  }
}

/**
 * Send broadcast notification to multiple users
 */
export async function broadcastNotification(
  payload: BroadcastPayload,
  userContext?: UserContext
): Promise<BroadcastResult> {
  console.log(`📢 [BROADCAST] Sending broadcast with target_type='${payload.target_type}'`);
  
  // Only admins can broadcast
  if (userContext?.role !== 'admin') {
    throw new AppError('Only admins can send broadcast notifications', 403);
  }

  // Expand recipients
  console.log(`📢 [BROADCAST] Expanding recipients...`);
  let recipients = await expandRecipients(payload);
  console.log(`📢 [BROADCAST] Recipients expanded to ${recipients.length} users:`, recipients.map(r => `${r.role}(${r.id.substring(0, 8)}...)`));

  if (recipients.length === 0) {
    console.warn('⚠️  No recipients found for broadcast');
    return {
      recipients_count: 0,
      success: false,
      created_count: 0,
    };
  }

  // Determine priority
  let priority = payload.priority || NOTIFICATION_PRIORITY.HIGH;
  if (
    payload.target_type === BroadcastTargetType.MAINTENANCE_ALERT ||
    payload.target_type === BroadcastTargetType.EMERGENCY
  ) {
    priority = NOTIFICATION_PRIORITY.URGENT;
  }

  // Publish notification
  const timestamp = Date.now();
  const eventKey = `broadcast:${payload.target_type}:${timestamp}`;

  console.log(`📢 [BROADCAST] Publishing notifications to ${recipients.length} users...`);
  const created = await publishNotification({
    recipients,
    notification_type: NOTIFICATION_TYPE.SYSTEM_BROADCAST,
    priority,
    title: payload.title,
    message: payload.message,
    related_entity_type: null,
    related_entity_id: null,
    action_url: payload.action_url || null,
    event_key: eventKey,
  });

  console.log(`📣 [BROADCAST] Broadcast completed: sent to ${recipients.length} users, created ${created.length} notifications`);

  return {
    recipients_count: recipients.length,
    success: created.length > 0,
    created_count: created.length,
  };
}
