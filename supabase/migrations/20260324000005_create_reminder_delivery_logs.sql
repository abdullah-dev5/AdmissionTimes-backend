-- Migration: Create reminder_delivery_logs table for scheduler observability
-- Created: 2026-03-24

CREATE TABLE IF NOT EXISTS reminder_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deadline_id UUID NOT NULL REFERENCES deadlines(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  threshold_day INTEGER NOT NULL CHECK (threshold_day > 0),
  notification_id UUID NULL REFERENCES notifications(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'deduped')),
  event_key TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminder_delivery_logs_status_created_at
  ON reminder_delivery_logs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reminder_delivery_logs_deadline
  ON reminder_delivery_logs(deadline_id);

CREATE INDEX IF NOT EXISTS idx_reminder_delivery_logs_recipient
  ON reminder_delivery_logs(recipient_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reminder_delivery_logs_event_status
  ON reminder_delivery_logs(event_key, status);

CREATE OR REPLACE FUNCTION set_reminder_delivery_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reminder_delivery_logs_updated_at ON reminder_delivery_logs;

CREATE TRIGGER trg_reminder_delivery_logs_updated_at
  BEFORE UPDATE ON reminder_delivery_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_reminder_delivery_logs_updated_at();
