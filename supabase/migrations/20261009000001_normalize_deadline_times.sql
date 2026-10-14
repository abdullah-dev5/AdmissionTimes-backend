-- Migration: deadlines close at 23:59:59 Pakistan time on their day
-- Created: 2026-10-09
--
-- The app treats a deadline as a calendar day that ends at 23:59:59 in
-- Pakistan (APP_UTC_OFFSET +05:00). Older rows were stored differently:
--   * 00:00:00 UTC   - date-only values parsed as UTC (scraper, some forms)
--   * 23:59:59 UTC   - old web form bug (end of day in UTC = 04:59 next day in PKT)
--   * arbitrary time - test data created relative to "now"
-- For the first two the intended day is the UTC date; otherwise the PKT date.

BEGIN;

WITH fixed AS (
  SELECT
    id,
    ((CASE
        WHEN (deadline AT TIME ZONE 'UTC')::time IN ('00:00:00', '23:59:59') THEN (deadline AT TIME ZONE 'UTC')::date
        ELSE (deadline AT TIME ZONE 'Asia/Karachi')::date
      END) + time '23:59:59') AT TIME ZONE 'Asia/Karachi' AS new_deadline
  FROM admissions
  WHERE deadline IS NOT NULL
)
UPDATE admissions a
SET deadline = f.new_deadline
FROM fixed f
WHERE a.id = f.id AND a.deadline IS DISTINCT FROM f.new_deadline;

UPDATE deadlines d
SET deadline_date = a.deadline, updated_at = NOW()
FROM admissions a
WHERE d.admission_id = a.id
  AND d.deadline_type = 'application'
  AND a.deadline IS NOT NULL
  AND d.deadline_date IS DISTINCT FROM a.deadline;

COMMIT;
