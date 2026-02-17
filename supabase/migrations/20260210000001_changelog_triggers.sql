-- ============================================================================
-- CHANGELOG AUTOMATION - DATABASE TRIGGERS
-- Migration: 20260210000001_changelog_triggers.sql
-- Created: 2026-02-10
-- Purpose: Automatically create changelog entries for admission changes
--          Complements existing programmatic changelog creation in admissions service
-- ============================================================================

-- ============================================================================
-- FUNCTION: Log Admission Status Changes (Admin Actions)
-- ============================================================================
-- Purpose: Capture admin verification/rejection/dispute actions that currently
--          only create audit_logs but not changelogs
-- Note: This trigger ONLY fires for verification_status changes
--       Other field changes are handled by admissions.service.ts

CREATE OR REPLACE FUNCTION log_admin_verification_changes()
RETURNS TRIGGER AS $$
DECLARE
  action_type_val change_action_type;
  user_id_val UUID;
BEGIN
  -- Only proceed if verification_status changed
  IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
    
    -- Determine action type from new status
    action_type_val := CASE NEW.verification_status
      WHEN 'verified' THEN 'verified'::change_action_type
      WHEN 'rejected' THEN 'rejected'::change_action_type
      WHEN 'disputed' THEN 'disputed'::change_action_type
      ELSE 'status_changed'::change_action_type
    END;
    
    -- Get the user who made the change (from verified_by or current user)
    user_id_val := COALESCE(NEW.verified_by, auth.uid());
    
    -- Create changelog entry
    INSERT INTO changelogs (
      id,
      admission_id,
      actor_type,
      changed_by,
      action_type,
      field_name,
      old_value,
      new_value,
      diff_summary,
      metadata,
      created_at
    ) VALUES (
      gen_random_uuid(),
      NEW.id,
      'admin'::actor_type,
      user_id_val,
      action_type_val,
      'verification_status',
      to_jsonb(OLD.verification_status),
      to_jsonb(NEW.verification_status),
      'Status changed from ' || OLD.verification_status || ' to ' || NEW.verification_status,
      jsonb_build_object(
        'trigger', 'auto',
        'rejection_reason', NEW.rejection_reason,
        'admin_notes', NEW.admin_notes,
        'verification_comments', NEW.verification_comments
      ),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_admin_verification_changes() IS 'Automatically creates changelog entries when admins verify/reject/dispute admissions';

-- ============================================================================
-- TRIGGER: Attach to admissions table
-- ============================================================================

DROP TRIGGER IF EXISTS admissions_admin_verification_changelog_trigger ON admissions;

CREATE TRIGGER admissions_admin_verification_changelog_trigger
AFTER UPDATE ON admissions
FOR EACH ROW
WHEN (OLD.verification_status IS DISTINCT FROM NEW.verification_status)
EXECUTE FUNCTION log_admin_verification_changes();

COMMENT ON TRIGGER admissions_admin_verification_changelog_trigger ON admissions 
IS 'Automatically logs admin verification/rejection/dispute actions to changelogs table';

-- ============================================================================
-- VERIFICATION QUERIES (Run manually to test)
-- ============================================================================

-- Test 1: Verify an admission and check changelog
/*
-- Simulate admin verification
UPDATE admissions 
SET 
  verification_status = 'verified',
  verified_by = '<admin-user-uuid>',
  verified_at = NOW(),
  verification_comments = 'Looks good!'
WHERE id = '<test-admission-uuid>';

-- Check changelog was created
SELECT 
  c.id,
  c.admission_id,
  c.actor_type,
  c.action_type,
  c.field_name,
  c.old_value,
  c.new_value,
  c.diff_summary,
  c.metadata,
  c.created_at
FROM changelogs c
WHERE c.admission_id = '<test-admission-uuid>'
AND c.action_type = 'verified'
ORDER BY c.created_at DESC
LIMIT 1;

-- Expected: One row with actor_type='admin', action_type='verified'
*/

-- Test 2: Reject an admission and check changelog
/*
UPDATE admissions 
SET 
  verification_status = 'rejected',
  verified_by = '<admin-user-uuid>',
  rejection_reason = 'Incomplete information'
WHERE id = '<test-admission-uuid>';

-- Check changelog
SELECT * FROM changelogs 
WHERE admission_id = '<test-admission-uuid>'
AND action_type = 'rejected'
ORDER BY created_at DESC 
LIMIT 1;

-- Expected: One row with actor_type='admin', action_type='rejected', rejection_reason in metadata
*/

-- Test 3: Dispute an admission and check changelog
/*
UPDATE admissions 
SET verification_status = 'disputed',
    verified_by = '<admin-user-uuid>',
    admin_notes = 'University disputes rejection'
WHERE id = '<test-admission-uuid>';

-- Check changelog
SELECT * FROM changelogs 
WHERE admission_id = '<test-admission-uuid>'
AND action_type = 'disputed'
ORDER BY created_at DESC 
LIMIT 1;

-- Expected: One row with actor_type='admin', action_type='disputed'
*/

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This trigger COMPLEMENTS the existing changelog creation in admissions.service.ts
-- 2. Programmatic creation still works for:
--    - Creation (handled by admissions.service.ts:171)
--    - Updates (handled by admissions.service.ts:206)
--    - Submission (handled by admissions.service.ts:386)
-- 3. This trigger fills the GAP for:
--    - Admin verification/rejection/dispute (admin.service.ts doesn't create changelogs)
-- 4. The trigger is CONDITIONAL (WHEN clause) to avoid duplicate entries
-- 5. Future improvement: Consolidate admin.service.ts to call admissions.service.ts methods
-- ============================================================================

-- END OF MIGRATION
