-- Migration: Row Level Security (RLS) Policies (PHASE 1)
-- Created: 2026-01-05
-- Updated: 2026-02-05
-- Description: Role-based RLS policies with auth.uid() enforcement
-- Status: Phase 1 - Secure RLS & JWT Verification

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ADMISSIONS POLICIES
-- ============================================================================

-- Policy 1: Public (anonymous) can read only VERIFIED admissions
CREATE POLICY "Public read verified admissions"
  ON admissions
  FOR SELECT
  USING (auth.role() = 'anon' AND verification_status = 'verified' AND is_active = true);

-- Policy 2: Authenticated students see verified + their own (all statuses)
CREATE POLICY "Student read own and verified admissions"
  ON admissions
  FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND (
      (verification_status = 'verified' AND is_active = true)
      OR created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Policy 3: Universities see their own admissions (all statuses)
CREATE POLICY "University read own admissions"
  ON admissions
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy 4: Admins see all admissions
CREATE POLICY "Admin read all admissions"
  ON admissions
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  );

-- Policy 5: Universities can create admissions
CREATE POLICY "University create admissions"
  ON admissions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'university'
  );

-- Policy 6: Universities can update their own admissions
CREATE POLICY "University update own admissions"
  ON admissions
  FOR UPDATE
  USING (
    created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy 7: Admins can update all admissions
CREATE POLICY "Admin update all admissions"
  ON admissions
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  );

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Policy 1: Users see only their own notifications
CREATE POLICY "User read own notifications"
  ON notifications
  FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy 2: Users can update their own notifications (mark as read)
CREATE POLICY "User update own notifications"
  ON notifications
  FOR UPDATE
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- Policy 3: Only backend (service role) can insert
-- No policy needed - service role bypasses RLS

-- ============================================================================
-- USER_PREFERENCES POLICIES
-- ============================================================================

CREATE POLICY "User read own preferences"
  ON user_preferences
  FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "User write own preferences"
  ON user_preferences
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- WATCHLISTS POLICIES
-- ============================================================================

CREATE POLICY "User read own watchlist"
  ON watchlists
  FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "User write own watchlist"
  ON watchlists
  FOR ALL
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- CHANGELOGS POLICIES (Audit Trail - Immutable)
-- ============================================================================

-- Policy 1: Admins see all changelogs
CREATE POLICY "Admin read changelogs"
  ON changelogs
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  );

-- Policy 2: Users see changelogs for their own admissions
CREATE POLICY "User read changelogs for own admissions"
  ON changelogs
  FOR SELECT
  USING (
    admission_id IN (
      SELECT id FROM admissions 
      WHERE created_by = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies - only service role can write (audit immutability)

-- ============================================================================
-- DEADLINES POLICIES
-- ============================================================================

-- Policy 1: Public can read deadlines for verified admissions
CREATE POLICY "Public read deadlines for verified admissions"
  ON deadlines
  FOR SELECT
  USING (
    admission_id IN (
      SELECT id FROM admissions 
      WHERE verification_status = 'verified' AND is_active = true
    )
  );

-- Policy 2: Authenticated can read all deadlines
CREATE POLICY "Authenticated read all deadlines"
  ON deadlines
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy 3: Only backend can write deadlines
-- No policy needed - service role bypasses RLS

-- ============================================================================
-- USER_ACTIVITY POLICIES
-- ============================================================================

-- Policy 1: Only backend can insert (system logging)
-- No policy needed - service role bypasses RLS

-- Policy 2: Users can read their own activity (optional)
CREATE POLICY "User read own activity"
  ON user_activity
  FOR SELECT
  USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- ============================================================================
-- ANALYTICS_EVENTS POLICIES
-- ============================================================================

-- Policy 1: Only backend can insert
-- No policy needed - service role bypasses RLS

-- Policy 2: Admins can read analytics
CREATE POLICY "Admin read analytics events"
  ON analytics_events
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'admin'
  );
