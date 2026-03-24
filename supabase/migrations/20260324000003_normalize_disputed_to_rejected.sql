-- Migration: normalize disputed status to rejected
-- Purpose: keep single terminal negative state as rejected while preserving reasons
-- Date: 2026-03-24

BEGIN;

-- 1) Convert existing disputed admissions to rejected and keep dispute reason text.
UPDATE admissions
SET
  verification_status = 'rejected',
  rejection_reason = COALESCE(
    NULLIF(rejection_reason, ''),
    CASE
      WHEN dispute_reason IS NOT NULL AND dispute_reason <> '' THEN 'Reconsideration requested: ' || dispute_reason
      ELSE 'Rejected'
    END
  ),
  updated_at = NOW()
WHERE verification_status = 'disputed';

-- 2) Convert changelog action_type disputed -> status_changed to preserve history without disputed state.
UPDATE changelogs
SET action_type = 'status_changed'
WHERE action_type = 'disputed';

-- 3) Guardrail trigger: any future disputed write is normalized to rejected.
CREATE OR REPLACE FUNCTION normalize_disputed_status_to_rejected()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.verification_status = 'disputed' THEN
    NEW.verification_status := 'rejected';

    IF NEW.rejection_reason IS NULL OR NEW.rejection_reason = '' THEN
      NEW.rejection_reason := COALESCE(
        CASE WHEN NEW.dispute_reason IS NOT NULL AND NEW.dispute_reason <> ''
          THEN 'Reconsideration requested: ' || NEW.dispute_reason
        END,
        'Rejected'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_disputed_status_to_rejected ON admissions;
CREATE TRIGGER trg_normalize_disputed_status_to_rejected
BEFORE INSERT OR UPDATE OF verification_status, dispute_reason, rejection_reason ON admissions
FOR EACH ROW
EXECUTE FUNCTION normalize_disputed_status_to_rejected();

COMMIT;
