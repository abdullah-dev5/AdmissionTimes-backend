-- Migration: remove invented display data
-- Created: 2026-10-08
--
-- Scraped admissions were inserted with a generated description
-- ("<title> at <university> is a <degree> program located in <location>.").
-- That is not source data; the response contract now derives display fields.
-- Also fills/normalizes university cities the contract uses for location.

BEGIN;

UPDATE admissions
SET description = NULL
WHERE data_origin = 'scraper'
  AND description ~ ' is a .+ program located in .+\.$';

UPDATE universities SET city = 'Topi', updated_at = NOW()
WHERE city IS NULL AND (name ILIKE 'GIKI' OR name ILIKE 'Ghulam Ishaq Khan%');

UPDATE universities SET city = initcap(city), updated_at = NOW()
WHERE city IS NOT NULL AND city = lower(city);

COMMIT;
