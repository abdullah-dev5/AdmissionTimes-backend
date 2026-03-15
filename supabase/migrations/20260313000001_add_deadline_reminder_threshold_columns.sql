-- Track reminder dispatch timestamps by threshold day (7, 3, 1)
-- These fields provide operational visibility into when reminders were sent.

ALTER TABLE deadlines
  ADD COLUMN IF NOT EXISTS reminder_sent_7d_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_3d_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_1d_at TIMESTAMPTZ;
