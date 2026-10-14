-- Migration: admission identity, duplicate cleanup, deadline backfill, credential cleanup
-- Created: 2026-10-07
--
-- 1. Scraper rows were keyed by a hash that included the deadline date, so a
--    deadline extension inserted a duplicate admission. Identity is now
--    md5(university_id | normalized title) (same formula as the API).
-- 2. Duplicate scraper admissions are merged into one canonical row; watchlists
--    move to the canonical row, the rest are deactivated.
-- 3. Every active admission with a deadline gets its 'application' row in
--    `deadlines` (reminders read only that table; scraped rows never had one).
-- 4. Plaintext passwords are removed: credentials live only in Supabase Auth.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1 + 2. Identity and duplicates
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE scraper_identity ON COMMIT DROP AS
SELECT
  a.id,
  md5(a.university_id::text || '|' || regexp_replace(lower(btrim(a.title)), '\s+', ' ', 'g')) AS identity_hash,
  row_number() OVER (
    PARTITION BY a.university_id, regexp_replace(lower(btrim(a.title)), '\s+', ' ', 'g')
    ORDER BY a.deadline DESC NULLS LAST, a.source_last_seen_at DESC NULLS LAST, a.updated_at DESC
  ) AS rank
FROM admissions a
WHERE a.is_active = true
  AND a.data_origin = 'scraper';

CREATE TEMP TABLE scraper_duplicates ON COMMIT DROP AS
SELECT dup.id AS duplicate_id, canon.id AS canonical_id
FROM scraper_identity dup
JOIN scraper_identity canon
  ON canon.identity_hash = dup.identity_hash AND canon.rank = 1
WHERE dup.rank > 1;

-- Move watchlists to the canonical admission (keep alert opt-in if any copy had it).
INSERT INTO watchlists (user_id, admission_id, notes, alert_opt_in, created_at, updated_at)
SELECT w.user_id, d.canonical_id, w.notes, w.alert_opt_in, w.created_at, NOW()
FROM watchlists w
JOIN scraper_duplicates d ON d.duplicate_id = w.admission_id
ON CONFLICT (user_id, admission_id)
DO UPDATE SET alert_opt_in = watchlists.alert_opt_in OR EXCLUDED.alert_opt_in, updated_at = NOW();

DELETE FROM watchlists w USING scraper_duplicates d WHERE w.admission_id = d.duplicate_id;
DELETE FROM recommendations r USING scraper_duplicates d WHERE r.admission_id = d.duplicate_id;
DELETE FROM deadlines dl USING scraper_duplicates d WHERE dl.admission_id = d.duplicate_id;

UPDATE admissions a
SET is_active = false,
    source_record_hash = NULL,
    updated_at = NOW()
FROM scraper_duplicates d
WHERE a.id = d.duplicate_id;

INSERT INTO changelogs (admission_id, actor_type, changed_by, action_type, field_name, old_value, new_value, diff_summary, metadata)
SELECT d.duplicate_id, 'system', NULL, 'updated', 'is_active', 'true'::jsonb, 'false'::jsonb,
       'Duplicate scraper admission merged into canonical record',
       jsonb_build_object('canonical_admission_id', d.canonical_id)
FROM scraper_duplicates d;

-- Free old hashes held by inactive rows, then re-key canonical rows.
UPDATE admissions SET source_record_hash = NULL
WHERE is_active = false AND source_record_hash IS NOT NULL;

UPDATE admissions a
SET source_record_hash = s.identity_hash
FROM scraper_identity s
WHERE a.id = s.id AND s.rank = 1;

-- ---------------------------------------------------------------------------
-- 3. Deadline rows for reminders
-- ---------------------------------------------------------------------------

INSERT INTO deadlines (admission_id, deadline_type, deadline_date)
SELECT a.id, 'application', a.deadline
FROM admissions a
WHERE a.is_active = true
  AND a.deadline IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM deadlines d WHERE d.admission_id = a.id AND d.deadline_type = 'application'
  );

UPDATE deadlines d
SET deadline_date = a.deadline,
    reminder_sent = false,
    reminder_sent_7d_at = NULL,
    reminder_sent_3d_at = NULL,
    reminder_sent_1d_at = NULL,
    updated_at = NOW()
FROM admissions a
WHERE d.admission_id = a.id
  AND d.deadline_type = 'application'
  AND a.deadline IS NOT NULL
  AND d.deadline_date IS DISTINCT FROM a.deadline;

-- ---------------------------------------------------------------------------
-- 4. Credentials
-- ---------------------------------------------------------------------------

ALTER TABLE users DROP COLUMN IF EXISTS password;

COMMIT;
