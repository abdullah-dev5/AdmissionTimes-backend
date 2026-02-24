-- Fix notifications table RLS - Add INSERT policy
-- Issue: Notifications couldn't be created because no INSERT policy was defined

-- Check if the policy exists before creating
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' AND policyname = 'Service can insert notifications'
  ) THEN
    CREATE POLICY "Service can insert notifications"
      ON notifications
      FOR INSERT
      WITH CHECK (true);
    
    RAISE NOTICE 'Created INSERT policy for notifications table';
  ELSE
    RAISE NOTICE 'INSERT policy for notifications already exists';
  END IF;
END
$$;

-- Also allow users to insert (future webhook/API scenario)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' AND policyname = 'Authenticated users can insert own notifications'
  ) THEN
    CREATE POLICY "Authenticated users can insert own notifications"
      ON notifications
      FOR INSERT
      WITH CHECK (
        recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        AND role_type = (SELECT role FROM users WHERE auth_user_id = auth.uid())
      );
    
    RAISE NOTICE 'Created authenticated user INSERT policy for notifications table';
  ELSE
    RAISE NOTICE 'Authenticated user INSERT policy already exists';
  END IF;
END
$$;
