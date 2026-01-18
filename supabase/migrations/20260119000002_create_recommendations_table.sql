-- Migration: Create recommendations table
-- Created: 2026-01-19
-- Description: Creates recommendations table for caching personalized student recommendations
-- Phase: Backend Implementation Plan - Recommendations Endpoint

-- Recommendations table for caching personalized recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  reason TEXT,
  factors JSONB,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Ensure one recommendation per user-admission pair
  UNIQUE(user_id, admission_id)
);

-- Add comments
COMMENT ON TABLE recommendations IS 'Cached personalized recommendations for students';
COMMENT ON COLUMN recommendations.score IS 'Match score from 0-100';
COMMENT ON COLUMN recommendations.factors IS 'JSONB object with scoring breakdown (degree_match, deadline_proximity, etc.)';
COMMENT ON COLUMN recommendations.expires_at IS 'When this recommendation expires (for cache invalidation)';

-- Create indexes for efficient querying
CREATE INDEX idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX idx_recommendations_user_score ON recommendations(user_id, score DESC);
CREATE INDEX idx_recommendations_admission_id ON recommendations(admission_id);
CREATE INDEX idx_recommendations_expires_at ON recommendations(expires_at) WHERE expires_at IS NOT NULL;

-- Note: Cannot use NOW() in index predicate (not immutable)
-- Filter expired recommendations in queries: WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP
