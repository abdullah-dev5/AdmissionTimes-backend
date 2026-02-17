-- Migration: Auto Status Transitions for Admissions
-- Date: 2026-02-11
-- Description: Automatically manages verification status transitions when universities update admissions
--
-- Business Rules:
-- 1. When university updates a VERIFIED admission → status changes to PENDING
-- 2. When university updates a REJECTED/DISPUTED admission → status changes to PENDING
-- 3. Pending admissions remain pending until admin action
-- 4. Creates changelog entries for status transitions

-- Add updated_by column to track who last updated (REQUIRED for trigger)
ALTER TABLE admissions 
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Add needs_reverification column if not exists
ALTER TABLE admissions 
ADD COLUMN IF NOT EXISTS needs_reverification BOOLEAN DEFAULT false;

-- Add verified_by column to track who verified
ALTER TABLE admissions 
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);

-- Add verified_at timestamp
ALTER TABLE admissions 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Function: Auto-update status when university edits admission
CREATE OR REPLACE FUNCTION auto_pending_on_university_update()
RETURNS TRIGGER AS $$
DECLARE
  v_old_status TEXT;
  v_updated_by_role TEXT;
BEGIN
  -- Skip if updated_by is not set (shouldn't happen but safeguard)
  IF NEW.updated_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the role of the user making the update
  SELECT role INTO v_updated_by_role
  FROM users
  WHERE id = NEW.updated_by;

  -- If role not found, skip (user might not exist yet)
  IF v_updated_by_role IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only apply auto-transition if updated by university role
  IF v_updated_by_role = 'university' THEN
    
    v_old_status := OLD.verification_status;
    
    -- Create changelog entries for each field that changed
    IF OLD.title IS DISTINCT FROM NEW.title THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'title',
        to_jsonb(OLD.title),
        to_jsonb(NEW.title)
      );
    END IF;

    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'description',
        to_jsonb(OLD.description),
        to_jsonb(NEW.description)
      );
    END IF;

    IF OLD.application_fee IS DISTINCT FROM NEW.application_fee THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'application_fee',
        to_jsonb(OLD.application_fee),
        to_jsonb(NEW.application_fee)
      );
    END IF;

    IF OLD.tuition_fee IS DISTINCT FROM NEW.tuition_fee THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'tuition_fee',
        to_jsonb(OLD.tuition_fee),
        to_jsonb(NEW.tuition_fee)
      );
    END IF;

    IF OLD.deadline IS DISTINCT FROM NEW.deadline THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'deadline',
        to_jsonb(OLD.deadline),
        to_jsonb(NEW.deadline)
      );
    END IF;

    IF OLD.program_type IS DISTINCT FROM NEW.program_type THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'program_type',
        to_jsonb(OLD.program_type),
        to_jsonb(NEW.program_type)
      );
    END IF;

    IF OLD.degree_level IS DISTINCT FROM NEW.degree_level THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'degree_level',
        to_jsonb(OLD.degree_level),
        to_jsonb(NEW.degree_level)
      );
    END IF;

    IF OLD.field_of_study IS DISTINCT FROM NEW.field_of_study THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'field_of_study',
        to_jsonb(OLD.field_of_study),
        to_jsonb(NEW.field_of_study)
      );
    END IF;

    IF OLD.duration IS DISTINCT FROM NEW.duration THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'duration',
        to_jsonb(OLD.duration),
        to_jsonb(NEW.duration)
      );
    END IF;

    IF OLD.delivery_mode IS DISTINCT FROM NEW.delivery_mode THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'delivery_mode',
        to_jsonb(OLD.delivery_mode),
        to_jsonb(NEW.delivery_mode)
      );
    END IF;

    IF OLD.location IS DISTINCT FROM NEW.location THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'location',
        to_jsonb(OLD.location),
        to_jsonb(NEW.location)
      );
    END IF;

    IF OLD.requirements IS DISTINCT FROM NEW.requirements THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'requirements',
        OLD.requirements,
        NEW.requirements
      );
    END IF;

    IF OLD.start_date IS DISTINCT FROM NEW.start_date THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'start_date',
        to_jsonb(OLD.start_date),
        to_jsonb(NEW.start_date)
      );
    END IF;

    IF OLD.currency IS DISTINCT FROM NEW.currency THEN
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value
      ) VALUES (
        NEW.id,
        'university'::actor_type,
        NEW.updated_by,
        'updated'::change_action_type,
        'currency',
        to_jsonb(OLD.currency),
        to_jsonb(NEW.currency)
      );
    END IF;
    
    -- Rule 1: If VERIFIED admission is updated by university → go to PENDING
    IF v_old_status = 'verified' THEN
      NEW.verification_status := 'pending';
      NEW.needs_reverification := true;
      
      -- Log this status change in changelogs
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value,
        diff_summary
      ) VALUES (
        NEW.id,
        'system'::actor_type,
        NEW.updated_by,
        'status_changed'::change_action_type,
        'verification_status',
        to_jsonb('verified'),
        to_jsonb('pending'),
        'Admission updated by university - requires re-verification'
      );
    END IF;
    
    -- Rule 2: If REJECTED or DISPUTED admission is updated → go to PENDING (fresh start)
    IF v_old_status IN ('rejected', 'disputed') THEN
      NEW.verification_status := 'pending';
      NEW.needs_reverification := false; -- Fresh submission
      NEW.rejection_reason := NULL;
      NEW.dispute_reason := NULL;
      
      -- Log this status change
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value,
        diff_summary
      ) VALUES (
        NEW.id,
        'system'::actor_type,
        NEW.updated_by,
        'status_changed'::change_action_type,
        'verification_status',
        to_jsonb(v_old_status),
        to_jsonb('pending'),
        'Admission updated after ' || v_old_status || ' - submitted for review again'
      );
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto status transitions
DROP TRIGGER IF EXISTS trigger_auto_pending_on_update ON admissions;

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

-- Function: Track admin verification actions
CREATE OR REPLACE FUNCTION track_admin_verification()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Get the role of the user making the update
  SELECT role INTO v_user_role
  FROM users
  WHERE id = NEW.updated_by;

  -- If admin is verifying, track the verifier and timestamp
  IF v_user_role = 'admin' AND NEW.verification_status = 'verified' AND OLD.verification_status != 'verified' THEN
    NEW.verified_by := NEW.updated_by;
    NEW.verified_at := NOW();
    NEW.needs_reverification := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for admin verification tracking
DROP TRIGGER IF EXISTS trigger_track_admin_verification ON admissions;

CREATE TRIGGER trigger_track_admin_verification
  BEFORE UPDATE ON admissions
  FOR EACH ROW
  WHEN (NEW.verification_status IS DISTINCT FROM OLD.verification_status)
  EXECUTE FUNCTION track_admin_verification();

-- Create index for faster queries on verification status
CREATE INDEX IF NOT EXISTS idx_admissions_verification_status 
ON admissions(verification_status);

-- Create index for needs_reverification flag
CREATE INDEX IF NOT EXISTS idx_admissions_needs_reverification 
ON admissions(needs_reverification) 
WHERE needs_reverification = true;

-- Create index for verified_by
CREATE INDEX IF NOT EXISTS idx_admissions_verified_by 
ON admissions(verified_by);

-- Add comment to table
COMMENT ON COLUMN admissions.needs_reverification IS 'True when a verified admission was updated by university and needs re-verification';
COMMENT ON COLUMN admissions.verified_by IS 'Admin user who verified this admission';
COMMENT ON COLUMN admissions.verified_at IS 'Timestamp when admission was verified';

-- Create view for admissions needing re-verification
CREATE OR REPLACE VIEW admissions_needing_reverification AS
SELECT 
  a.*,
  u.email as verified_by_email,
  u.display_name as verified_by_name
FROM admissions a
LEFT JOIN users u ON a.verified_by = u.id
WHERE a.needs_reverification = true
  AND a.verification_status = 'pending'
ORDER BY a.updated_at DESC;

COMMENT ON VIEW admissions_needing_reverification IS 'Admissions that were verified but updated by university, requiring re-verification';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Auto status transition triggers created successfully';
  RAISE NOTICE '✅ University updates to verified admissions will auto-set to pending';
  RAISE NOTICE '✅ Updates to rejected/disputed admissions will reset to pending';
  RAISE NOTICE '✅ Admin verification tracking enabled';
END $$;
