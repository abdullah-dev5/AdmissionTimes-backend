-- Migration: Create Universities Table
-- Created: 2026-02-07
-- Description: Adds universities table for university profile management
-- Phase: University Profiles

-- ============================================================================
-- UNIVERSITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  country VARCHAR(100),
  website VARCHAR(255),
  logo_url TEXT,
  description TEXT,
  address TEXT,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE universities IS 'University profiles for admissions ownership and public display';
COMMENT ON COLUMN universities.name IS 'Official university name';
COMMENT ON COLUMN universities.logo_url IS 'Optional logo URL';
COMMENT ON COLUMN universities.contact_email IS 'Primary contact email for university profile';
COMMENT ON COLUMN universities.contact_phone IS 'Primary contact phone for university profile';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_universities_name ON universities(name);
CREATE INDEX IF NOT EXISTS idx_universities_city ON universities(city);
CREATE INDEX IF NOT EXISTS idx_universities_created_at ON universities(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_universities_updated_at ON universities;
CREATE TRIGGER update_universities_updated_at
  BEFORE UPDATE ON universities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
