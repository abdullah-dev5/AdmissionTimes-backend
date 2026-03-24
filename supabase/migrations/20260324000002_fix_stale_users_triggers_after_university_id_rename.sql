-- Migration: remove stale users triggers/functions referencing organization_id
-- Purpose: fix runtime errors after users.organization_id -> users.university_id rename
-- Error addressed: record "new" has no field "organization_id"
-- Date: 2026-03-24

BEGIN;

DO $$
DECLARE
  stale RECORD;
BEGIN
  -- Find users-table triggers whose function still references old users record fields.
  FOR stale IN
    SELECT
      p.oid,
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE NOT t.tgisinternal
      AND c.relname = 'users'
      AND n.nspname = 'public'
      AND (
        pg_get_functiondef(p.oid) ILIKE '%new.organization_id%'
        OR pg_get_functiondef(p.oid) ILIKE '%old.organization_id%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.users', stale.trigger_name);
    RAISE NOTICE 'Dropped stale trigger %.users.%', stale.schema_name, stale.trigger_name;

    -- Drop the stale function itself.
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s)',
      stale.schema_name,
      stale.function_name,
      stale.identity_args
    );

    RAISE NOTICE 'Dropped stale function %.%(%)', stale.schema_name, stale.function_name, stale.identity_args;
  END LOOP;
END $$;

COMMIT;
