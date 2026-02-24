-- Update notifications RLS policies for recipient_id and role_type ownership

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User read own notifications" ON notifications;
DROP POLICY IF EXISTS "User update own notifications" ON notifications;

CREATE POLICY "User read own notifications"
  ON notifications
  FOR SELECT
  USING (
    recipient_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND role_type = (SELECT role FROM users WHERE auth_user_id = auth.uid())
  );

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
