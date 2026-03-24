-- Migration: Create email_delivery_logs table for SMTP observability and replay
-- Created: 2026-03-24

CREATE TABLE IF NOT EXISTS email_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  provider_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_notification
  ON email_delivery_logs(notification_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status
  ON email_delivery_logs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_recipient
  ON email_delivery_logs(recipient_email, created_at DESC);
