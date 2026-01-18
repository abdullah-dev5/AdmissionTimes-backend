-- Migration: Create Seed Tracking Table
-- Created: 2026-01-18
-- Description: Tracks executed seed scripts for idempotent seeding

-- ============================================================================
-- SEED TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS seed_tracking (
  id SERIAL PRIMARY KEY,
  seed_name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  record_count INTEGER, -- Optional: track how many records were seeded
  metadata JSONB -- Optional: additional seed execution metadata
);

COMMENT ON TABLE seed_tracking IS 'Tracks executed seed scripts to ensure idempotent seeding';
COMMENT ON COLUMN seed_tracking.seed_name IS 'Name of the seed script (e.g., "admissions", "users")';
COMMENT ON COLUMN seed_tracking.record_count IS 'Number of records seeded (optional)';
COMMENT ON COLUMN seed_tracking.metadata IS 'Additional metadata about seed execution (optional)';

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_seed_tracking_seed_name ON seed_tracking(seed_name);
CREATE INDEX IF NOT EXISTS idx_seed_tracking_executed_at ON seed_tracking(executed_at DESC);
