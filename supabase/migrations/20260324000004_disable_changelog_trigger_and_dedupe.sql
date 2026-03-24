-- ============================================================================
-- Disable duplicate verification changelog trigger and dedupe existing rows
-- Migration: 20260324000004_disable_changelog_trigger_and_dedupe.sql
-- Created: 2026-03-24
-- Purpose:
-- 1) Stop duplicate changelog rows for admin verify/reject flows
--    (service-level writes + DB trigger were both inserting)
-- 2) Remove existing duplicate verification_status changelog rows
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1) Disable trigger-based verification changelog writes.
-- Service layer already creates changelog entries and should remain source of truth.
-- --------------------------------------------------------------------------
DROP TRIGGER IF EXISTS admissions_admin_verification_changelog_trigger ON admissions;
DROP FUNCTION IF EXISTS log_admin_verification_changes();

-- --------------------------------------------------------------------------
-- 2) One-time dedupe for existing verification_status rows.
-- Keep the first row in each near-identical group and delete the rest.
-- Grouping uses a 1-minute bucket to catch same-action double inserts.
-- --------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY
        admission_id,
        actor_type,
        COALESCE(changed_by::text, ''),
        action_type,
        COALESCE(field_name, ''),
        COALESCE(old_value::text, ''),
        COALESCE(new_value::text, ''),
        date_trunc('minute', created_at)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM changelogs
  WHERE field_name = 'verification_status'
    AND action_type IN ('verified', 'rejected', 'status_changed')
)
DELETE FROM changelogs c
USING ranked r
WHERE c.ctid = r.ctid
  AND r.rn > 1;

COMMIT;
