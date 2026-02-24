-- Comprehensive RLS policy setup for notifications table
-- Consolidates all INSERT, SELECT, UPDATE, and DELETE policies

-- Ensure RLS is enabled on notifications table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Authenticated users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "Backend service can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Service can insert notifications" ON notifications;
DROP POLICY IF EXISTS "System insert notifications" ON notifications;
DROP POLICY IF EXISTS "Read own notifications" ON notifications;
DROP POLICY IF EXISTS "User read own notifications" ON notifications;
DROP POLICY IF EXISTS "User update own notifications" ON notifications;
DROP POLICY IF EXISTS "Update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;

-- ============================================================================
-- INSERT POLICIES - Allow different roles to insert notifications
-- ============================================================================

-- 1. Authenticated users can insert their own notifications
-- (When user creates their own notification record)
CREATE POLICY "Authenticated users can insert own notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND role_type = (SELECT role FROM users WHERE auth_user_id = auth.uid())
  );

-- 2. Backend service can insert notifications
-- (Backend postgres user, service role, or direct connections bypass auth checks)
CREATE POLICY "Backend service can insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- 3. System insert notifications
-- (For system-generated notifications from triggers or batch processes)
CREATE POLICY "System insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- SELECT POLICIES - Allow users to read their own notifications
-- ============================================================================

-- 1. User read own notifications
-- Allow users to view notifications addressed to them
CREATE POLICY "User read own notifications"
  ON notifications
  FOR SELECT
  USING (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND role_type = (SELECT role FROM users WHERE auth_user_id = auth.uid())
  );

-- 2. Users can view their own notifications (alias for consistency)
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- UPDATE POLICIES - Allow users to update notification status (read, etc)
-- ============================================================================

-- 1. User update own notifications
-- Allow users to mark their notifications as read
CREATE POLICY "User update own notifications"
  ON notifications
  FOR UPDATE
  USING (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND role_type = (SELECT role FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND role_type = (SELECT role FROM users WHERE auth_user_id = auth.uid())
  );

-- 2. Users can update their own notifications (more permissive)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- 3. Update own notifications (alias)
CREATE POLICY "Update own notifications"
  ON notifications
  FOR UPDATE
  USING (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- DELETE POLICIES - Allow users to delete their own notifications
-- ============================================================================

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON notifications
  FOR DELETE
  USING (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- DEBUG INFO
-- ============================================================================
-- To verify these policies are in place, run:
-- SELECT * FROM pg_policies WHERE tablename='notifications' ORDER BY policyname;
