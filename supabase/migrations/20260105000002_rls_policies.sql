-- Migration: Row Level Security (RLS) Policies
-- Created: 2026-01-05
-- Description: Enables RLS and creates security policies for all tables

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

-- Public read access for verified admissions
CREATE POLICY "Public read verified admissions"
  ON admissions
  FOR SELECT
  USING (verification_status = 'verified' AND is_active = true);

-- Authenticated users can read all admissions (for now, allow all)
-- TODO: Restrict to authenticated users when auth is implemented
CREATE POLICY "Authenticated read all admissions"
  ON admissions
  FOR SELECT
  USING (true);

-- Authenticated write access (for universities and admins)
-- TODO: Restrict based on user role when auth is implemented
CREATE POLICY "Authenticated write admissions"
  ON admissions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- CHANGELOGS POLICIES
-- ============================================================================

-- Public read access (audit trail is public)
CREATE POLICY "Public read changelogs"
  ON changelogs
  FOR SELECT
  USING (true);

-- System-only insert (immutable - only system can insert)
-- TODO: Restrict to service role when auth is implemented
CREATE POLICY "System insert changelogs"
  ON changelogs
  FOR INSERT
  WITH CHECK (true);

-- No updates or deletes (immutable table)
-- RLS will prevent all updates/deletes by default

-- ============================================================================
-- DEADLINES POLICIES
-- ============================================================================

-- Public read access
CREATE POLICY "Public read deadlines"
  ON deadlines
  FOR SELECT
  USING (true);

-- Authenticated modify access
-- TODO: Restrict based on user role when auth is implemented
CREATE POLICY "Authenticated modify deadlines"
  ON deadlines
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- NOTIFICATIONS POLICIES
-- ============================================================================

-- Users can read their own notifications
-- TODO: Use auth.uid() when auth is implemented
-- For now, allow read based on user_type matching
CREATE POLICY "Read own notifications"
  ON notifications
  FOR SELECT
  USING (true); -- TODO: Replace with auth.uid() = user_id

-- Users can update their own notifications (mark as read)
CREATE POLICY "Update own notifications"
  ON notifications
  FOR UPDATE
  USING (true) -- TODO: Replace with auth.uid() = user_id
  WITH CHECK (true);

-- System can insert notifications
-- TODO: Restrict to service role when auth is implemented
CREATE POLICY "System insert notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- USER ACTIVITY POLICIES
-- ============================================================================

-- Users can read their own activity
-- TODO: Use auth.uid() when auth is implemented
CREATE POLICY "Read own activity"
  ON user_activity
  FOR SELECT
  USING (true); -- TODO: Replace with auth.uid() = user_id

-- Authenticated users can insert their own activity
-- TODO: Restrict based on user role when auth is implemented
CREATE POLICY "Insert own activity"
  ON user_activity
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- ANALYTICS EVENTS POLICIES
-- ============================================================================

-- Admin read access only
-- TODO: Restrict to admin role when auth is implemented
CREATE POLICY "Admin read analytics"
  ON analytics_events
  FOR SELECT
  USING (true); -- TODO: Replace with user role check

-- System can insert analytics events
-- TODO: Restrict to service role when auth is implemented
CREATE POLICY "System insert analytics"
  ON analytics_events
  FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- NOTES FOR FUTURE AUTH INTEGRATION
-- ============================================================================

-- When Supabase Auth is integrated:
-- 1. Replace `USING (true)` with `USING (auth.uid() = user_id)` for user-specific data
-- 2. Add role-based policies using `auth.jwt() ->> 'user_role'`
-- 3. Use service role for system inserts (bypass RLS)
-- 4. Update policies to check user roles:
--    - Students: read verified admissions, own notifications/activity
--    - Universities: read/write own admissions, own notifications
--    - Admins: full access to all tables
