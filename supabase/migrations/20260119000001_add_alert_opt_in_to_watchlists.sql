-- Migration: Add alert_opt_in to watchlists table
-- Created: 2026-01-19
-- Description: Adds alert_opt_in field to watchlists for deadline alert preferences
-- Phase: Backend Implementation Plan - Dashboard Endpoints

-- Add alert_opt_in column to watchlists table
ALTER TABLE watchlists
ADD COLUMN IF NOT EXISTS alert_opt_in BOOLEAN NOT NULL DEFAULT false;

-- Add comment
COMMENT ON COLUMN watchlists.alert_opt_in IS 'Whether user wants to receive deadline alerts for this admission';

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_watchlists_alert_opt_in ON watchlists(alert_opt_in) WHERE alert_opt_in = true;
