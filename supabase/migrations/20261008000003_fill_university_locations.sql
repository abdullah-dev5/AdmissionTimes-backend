-- Migration: fill missing university locations used for display
-- Created: 2026-10-08

BEGIN;

UPDATE universities SET city = 'Karachi', updated_at = NOW()
WHERE city IS NULL AND name ILIKE 'IBA Karachi';

-- Every university in the system is Pakistani; the country was simply left blank.
UPDATE universities SET country = 'Pakistan', updated_at = NOW()
WHERE country IS NULL;

COMMIT;
