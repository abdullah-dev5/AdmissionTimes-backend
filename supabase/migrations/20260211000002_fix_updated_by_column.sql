-- Fix Migration: Add missing updated_by column
-- Date: 2026-02-11
-- Description: Adds the missing updated_by column that the triggers need

-- First, drop the existing triggers that reference the missing column
DROP TRIGGER IF EXISTS trigger_auto_pending_on_update ON admissions;
DROP TRIGGER IF EXISTS trigger_track_admin_verification ON admissions;

-- Add the missing updated_by column
ALTER TABLE admissions 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Add comment
COMMENT ON COLUMN admissions.updated_by IS 'User who last updated this admission';

-- Create index for updated_by
CREATE INDEX IF NOT EXISTS idx_admissions_updated_by 
ON admissions(updated_by);

-- Recreate the trigger (with the corrected function that checks for null)
CREATE TRIGGER trigger_auto_pending_on_update
  BEFORE UPDATE ON admissions
  FOR EACH ROW
  WHEN (
    -- Only fire when actual content changes (not just updated_at)
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.deadline IS DISTINCT FROM NEW.deadline OR
    OLD.application_fee IS DISTINCT FROM NEW.application_fee OR
    OLD.tuition_fee IS DISTINCT FROM NEW.tuition_fee OR
    OLD.requirements IS DISTINCT FROM NEW.requirements OR
    OLD.program_type IS DISTINCT FROM NEW.program_type OR
    OLD.degree_level IS DISTINCT FROM NEW.degree_level OR
    OLD.field_of_study IS DISTINCT FROM NEW.field_of_study OR
    OLD.duration IS DISTINCT FROM NEW.duration OR
    OLD.start_date IS DISTINCT FROM NEW.start_date OR
    OLD.location IS DISTINCT FROM NEW.location OR
    OLD.delivery_mode IS DISTINCT FROM NEW.delivery_mode
  )
  EXECUTE FUNCTION auto_pending_on_university_update();

-- Recreate the admin verification tracking trigger
CREATE TRIGGER trigger_track_admin_verification
  BEFORE UPDATE ON admissions
  FOR EACH ROW
  WHEN (NEW.verification_status IS DISTINCT FROM OLD.verification_status)
  EXECUTE FUNCTION track_admin_verification();

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Added updated_by column';
  RAISE NOTICE '✅ Recreated triggers successfully';
END $$;
