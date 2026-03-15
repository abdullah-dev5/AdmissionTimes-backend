-- ============================================================================
-- PUSH NOTIFICATION TOKENS - DATABASE MIGRATION
-- File: migrations/002_push_notification_tokens.sql
-- Date: March 13, 2026
-- Purpose: Store Expo push tokens per user/device for mobile push delivery
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (platform IN ('ios', 'android', 'web', 'unknown')),
  device_id VARCHAR(255) DEFAULT NULL,
  app_version VARCHAR(50) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active
  ON push_notification_tokens(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_push_tokens_token_active
  ON push_notification_tokens(expo_push_token, is_active);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
