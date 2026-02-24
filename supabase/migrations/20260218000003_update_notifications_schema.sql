-- Step 1: Rename columns
ALTER TABLE notifications RENAME COLUMN user_id TO recipient_id;
ALTER TABLE notifications RENAME COLUMN user_type TO role_type;
ALTER TABLE notifications RENAME COLUMN category TO notification_type_temp;

-- Step 2: Convert enum column to text to avoid PostgreSQL enum transaction constraint
ALTER TABLE notifications ALTER COLUMN notification_type_temp TYPE text;

-- Step 3: Map legacy values to new taxonomy
UPDATE notifications
SET notification_type_temp = 'admission_verified'
WHERE notification_type_temp = 'verification';

UPDATE notifications
SET notification_type_temp = 'deadline_near'
WHERE notification_type_temp = 'deadline';

UPDATE notifications
SET notification_type_temp = 'system_broadcast'
WHERE notification_type_temp = 'system';

UPDATE notifications
SET notification_type_temp = 'admission_updated_saved'
WHERE notification_type_temp = 'update';

-- Step 4: Rename the old enum type and create new one
ALTER TYPE notification_category RENAME TO notification_type_old;

CREATE TYPE notification_type AS ENUM (
  'admission_submitted',
  'admission_resubmitted',
  'admission_verified',
  'admission_rejected',
  'admission_revision_required',
  'admission_updated_saved',
  'deadline_near',
  'system_broadcast',
  'dispute_raised',
  'system_error'
);

-- Step 5: Convert back to enum with new type
ALTER TABLE notifications ALTER COLUMN notification_type_temp TYPE notification_type USING notification_type_temp::notification_type;

-- Step 6: Rename column back to notification_type
ALTER TABLE notifications RENAME COLUMN notification_type_temp TO notification_type;

-- Step 7: Add event key for idempotency
ALTER TABLE notifications ADD COLUMN if NOT EXISTS event_key VARCHAR(200);

UPDATE notifications
SET event_key = md5(
  COALESCE(notification_type::text, '') || ':' ||
  COALESCE(recipient_id::text, '') || ':' ||
  COALESCE(related_entity_id::text, '') || ':' ||
  id::text
)
WHERE event_key IS NULL;

ALTER TABLE notifications ALTER COLUMN event_key SET NOT NULL;

-- Step 8: Update indexes
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_user_type;
DROP INDEX IF EXISTS idx_notifications_user_read;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role_type ON notifications(role_type);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type_created_at ON notifications(notification_type, created_at DESC);

-- Step 9: Idempotency unique constraint
ALTER TABLE notifications
  ADD CONSTRAINT notifications_event_key_unique
  UNIQUE (recipient_id, notification_type, related_entity_id, event_key);

-- Step 10: Drop old enum type
DROP TYPE notification_type_old;
