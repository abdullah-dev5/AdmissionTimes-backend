-- Migration: close the Supabase Data API (PostgREST) to clients
-- Created: 2026-10-08
--
-- The anon key ships in the web bundle and the mobile app. With the previous
-- grants and policies anyone could, straight through /rest/v1 and bypassing
-- the API's authorization:
--   * write/verify/delete admissions and deadlines ("ALL ... true" policies),
--   * insert notifications for any user and create universities,
--   * read/modify tables with RLS disabled (email_delivery_logs with email
--     addresses, push tokens, user_preferences, watchlists, audit logs, ...).
--
-- The clients use Supabase only for Auth and Realtime; all data goes through
-- the backend, which connects as the table owner (unaffected by RLS/grants).
-- So: revoke everything from anon/authenticated, enable RLS everywhere, and
-- allow exactly one thing — a signed-in user reading their own notifications
-- (needed for Realtime postgres_changes).

BEGIN;

-- 1. No table/sequence privileges for client roles (now or for future tables).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- 2. RLS on every public table, with all previous (largely permissive) policies removed.
DO $$
DECLARE
  t record;
  pol record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  FOR pol IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- 3. Own-notification reads for Realtime. The users lookup runs as definer so
--    client roles need no access to the users table.
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid() AND status = 'active' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;

GRANT SELECT ON public.notifications TO authenticated;

CREATE POLICY "Users read own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (recipient_id = public.current_app_user_id());

-- 4. Publish notification changes to Realtime.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

COMMIT;
