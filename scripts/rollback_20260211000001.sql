-- Rollback the auto_status_transitions migration
-- Run this to reset the migration so it can be re-run

-- Drop existing objects
DROP VIEW IF EXISTS admissions_needing_reverification;
DROP TRIGGER IF EXISTS trigger_track_admin_verification ON admissions;
DROP TRIGGER IF EXISTS trigger_auto_pending_on_update ON admissions;
DROP FUNCTION IF EXISTS track_admin_verification();
DROP FUNCTION IF EXISTS auto_pending_on_university_update();

-- Remove the columns we added
ALTER TABLE admissions DROP COLUMN IF EXISTS needs_reverification;
ALTER TABLE admissions DROP COLUMN IF EXISTS verified_by;
ALTER TABLE admissions DROP COLUMN IF EXISTS verified_at;
ALTER TABLE admissions DROP COLUMN IF EXISTS updated_by;

-- Delete the indexes
DROP INDEX IF EXISTS idx_admissions_verification_status;
DROP INDEX IF EXISTS idx_admissions_needs_reverification;
DROP INDEX IF EXISTS idx_admissions_verified_by;

-- Delete migration record
DELETE FROM migration_history WHERE migration_name = '20260211000001_auto_status_transitions.sql';

SELECT '✅ Migration 20260211000001 rolled back successfully' as status;
