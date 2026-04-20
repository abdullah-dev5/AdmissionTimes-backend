-- Migration: Fix ON CONFLICT target for admissions(source_record_hash)
-- Created: 2026-04-15
-- Reason: ON CONFLICT (source_record_hash) requires a non-partial unique index/constraint.

BEGIN;

-- Replace partial unique index with full unique index so UPSERT can target it.
DROP INDEX IF EXISTS public.uq_admissions_source_record_hash;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admissions_source_record_hash
  ON public.admissions (source_record_hash);

COMMIT;
