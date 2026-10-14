-- Migration: drop the broken auto-pending trigger on admissions
-- Created: 2026-10-07
--
-- auto_pending_on_university_update() inserted into changelogs columns that do
-- not exist ("reason", "created_by") with an invalid action_type
-- ('status_change'). It only fired when admissions.updated_by was set, which the
-- API never did, so it was dead code; now that updated_by is maintained every
-- university edit of a verified/rejected admission failed with HTTP 500.
--
-- The admissions service implements these rules (re-verification after edits,
-- resubmission of rejected admissions) with valid changelog entries, so the
-- trigger is removed rather than repaired. track_admin_verification() is kept.

BEGIN;

DROP TRIGGER IF EXISTS trigger_auto_pending_on_update ON public.admissions;
DROP FUNCTION IF EXISTS public.auto_pending_on_university_update();

COMMIT;
