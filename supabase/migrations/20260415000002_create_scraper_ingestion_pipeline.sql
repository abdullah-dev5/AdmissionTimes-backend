-- Migration: Scraper ingestion pipeline (mirror + controlled publish scaffolding)
-- Created: 2026-04-15

BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Add scraper provenance fields to canonical admissions (additive only)
-- ----------------------------------------------------------------------------
ALTER TABLE public.admissions
  ADD COLUMN IF NOT EXISTS data_origin text,
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_record_hash text,
  ADD COLUMN IF NOT EXISTS source_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS ingestion_run_id uuid;

CREATE INDEX IF NOT EXISTS idx_admissions_source_record_hash
  ON public.admissions (source_record_hash)
  WHERE source_record_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admissions_source_record_hash
  ON public.admissions (source_record_hash)
  WHERE source_record_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admissions_data_origin
  ON public.admissions (data_origin)
  WHERE data_origin IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2) Scraper ingestion run table (batch-level observability)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scraper_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('mirror', 'publish')),
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  source_system text NOT NULL DEFAULT 'AdmissionTimes-Scrapers',
  requested_by text,
  university_scope text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  mirrored_count integer NOT NULL DEFAULT 0,
  published_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_log jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraper_ingestion_runs_status
  ON public.scraper_ingestion_runs (status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraper_ingestion_runs_mode
  ON public.scraper_ingestion_runs (mode, started_at DESC);

-- ----------------------------------------------------------------------------
-- 3) Scraper ingestion event table (record-level observability)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scraper_ingestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.scraper_ingestion_runs(id) ON DELETE CASCADE,
  source_record_hash text,
  source_university_name text,
  source_program_title text,
  source_last_date text,
  source_details_link text,
  event_status text NOT NULL CHECK (event_status IN ('mirrored', 'inserted', 'updated', 'skipped', 'failed')),
  canonical_admission_id uuid REFERENCES public.admissions(id) ON DELETE SET NULL,
  reason text,
  error_detail text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraper_ingestion_events_run
  ON public.scraper_ingestion_events (run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraper_ingestion_events_status
  ON public.scraper_ingestion_events (event_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraper_ingestion_events_source_hash
  ON public.scraper_ingestion_events (source_record_hash)
  WHERE source_record_hash IS NOT NULL;

ALTER TABLE public.admissions
  ADD CONSTRAINT fk_admissions_ingestion_run
  FOREIGN KEY (ingestion_run_id)
  REFERENCES public.scraper_ingestion_runs(id)
  ON DELETE SET NULL;

COMMIT;
