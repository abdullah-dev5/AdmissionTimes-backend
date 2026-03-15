import { query } from '@db/connection';

export interface PushTokenRecord {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  device_id: string | null;
  app_version: string | null;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export const upsertPushToken = async (params: {
  userId: string;
  expoPushToken: string;
  platform?: 'ios' | 'android' | 'web' | 'unknown';
  deviceId?: string | null;
  appVersion?: string | null;
}): Promise<PushTokenRecord> => {
  const platform = params.platform || 'unknown';

  await query(
    `
      UPDATE push_notification_tokens
      SET is_active = false, updated_at = NOW()
      WHERE expo_push_token = $1 AND user_id <> $2
    `,
    [params.expoPushToken, params.userId]
  );

  const result = await query(
    `
      INSERT INTO push_notification_tokens (
        user_id,
        expo_push_token,
        platform,
        device_id,
        app_version,
        is_active,
        last_used_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      ON CONFLICT (user_id, expo_push_token)
      DO UPDATE
      SET
        platform = EXCLUDED.platform,
        device_id = EXCLUDED.device_id,
        app_version = EXCLUDED.app_version,
        is_active = true,
        last_used_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `,
    [params.userId, params.expoPushToken, platform, params.deviceId || null, params.appVersion || null]
  );

  return result.rows[0] as PushTokenRecord;
};

export const listActivePushTokensForUser = async (userId: string): Promise<string[]> => {
  const result = await query(
    `
      SELECT expo_push_token
      FROM push_notification_tokens
      WHERE user_id = $1 AND is_active = true
      ORDER BY updated_at DESC
    `,
    [userId]
  );

  return result.rows.map((row) => row.expo_push_token);
};

export const deactivatePushTokenForUser = async (userId: string, expoPushToken: string): Promise<number> => {
  const result = await query(
    `
      UPDATE push_notification_tokens
      SET is_active = false, updated_at = NOW()
      WHERE user_id = $1 AND expo_push_token = $2 AND is_active = true
    `,
    [userId, expoPushToken]
  );

  return result.rowCount || 0;
};
