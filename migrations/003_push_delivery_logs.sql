-- ============================================================================
-- PUSH DELIVERY LOGS - DATABASE MIGRATION
-- File: migrations/003_push_delivery_logs.sql
-- Date: April 1, 2026
-- Purpose: Persist push delivery attempts and provider results for observability
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NULL REFERENCES notifications(id) ON DELETE SET NULL,
  recipient_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  token_hash VARCHAR(64) NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'expo',
  ticket_status VARCHAR(30) NOT NULL,
  ticket_id VARCHAR(255) NULL,
  error_code VARCHAR(100) NULL,
  error_message TEXT NULL,
  http_status INTEGER NULL,
  provider_response JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_notification
  ON push_delivery_logs(notification_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_recipient
  ON push_delivery_logs(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_status
  ON push_delivery_logs(ticket_status, created_at DESC);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================