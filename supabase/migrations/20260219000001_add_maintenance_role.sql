-- Add MAINTENANCE role to user_type enum
-- This allows system maintenance staff to send maintenance notifications

-- Step 1: Add new enum value to user_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'user_type'
      AND e.enumlabel = 'maintenance'
  ) THEN
    ALTER TYPE user_type ADD VALUE 'maintenance' AFTER 'admin';
  END IF;
END $$;

-- Step 2: Verify enum was added successfully
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_type'::regtype ORDER BY enumsortorder;

-- Step 3: Create RLS policy for maintenance role (can read all notifications)
-- Maintenance staff should see system and broadcast notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'maintenance_see_notifications'
  ) THEN
    EXECUTE '
      CREATE POLICY "maintenance_see_notifications"
      ON notifications
      FOR SELECT
      USING (
        (auth.jwt() ->> ''role'') = ''maintenance''
        AND role_type::text = ''maintenance''
      )
    ';
  END IF;
END $$;

-- Step 4: Create policy for maintenance to create notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'maintenance_create_notifications'
  ) THEN
    EXECUTE '
      CREATE POLICY "maintenance_create_notifications"
      ON notifications
      FOR INSERT
      WITH CHECK (
        (auth.jwt() ->> ''role'') = ''maintenance''
      )
    ';
  END IF;
END $$;

-- Done! Maintenance role is now available
