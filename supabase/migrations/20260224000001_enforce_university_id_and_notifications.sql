-- Migration: Enforce university_id and align notification/deadline columns
-- Date: 2026-02-24
-- Description:
-- 1) Backfill admissions.university_id from users.(organization_id|university_id)
-- 2) Remove test admissions with NULL university_id
-- 3) Enforce admissions.university_id as NOT NULL
-- 4) Ensure deadline reminder and notification read_at columns exist

BEGIN;

-- Backfill university_id from creator's organization
DO $$
DECLARE
  users_university_column text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'university_id'
  ) THEN
    users_university_column := 'university_id';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'organization_id'
  ) THEN
    users_university_column := 'organization_id';
  ELSE
    RAISE EXCEPTION 'Neither users.university_id nor users.organization_id exists';
  END IF;

  EXECUTE format(
    'UPDATE admissions a
       SET university_id = u.%I
      FROM users u
     WHERE a.university_id IS NULL
       AND a.created_by = u.id
       AND u.%I IS NOT NULL',
    users_university_column,
    users_university_column
  );
END $$;

-- Remove remaining NULL university_id admissions (test data)
DELETE FROM admissions
WHERE university_id IS NULL;

-- Enforce university_id not null
ALTER TABLE admissions
  ALTER COLUMN university_id SET NOT NULL;

-- Ensure deadlines.reminder_sent exists
ALTER TABLE deadlines
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

-- Ensure notifications.read_at exists
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone NULL;

COMMIT;
