-- Migration: Create Users Table
-- Created: 2026-01-13
-- Description: Creates users table for identity mapping and role intent model
-- Phase: 4B - Users Domain

-- ============================================================================
-- USERS TABLE
-- ============================================================================

-- Users table (IDENTITY & OWNERSHIP)
-- Maps Supabase Auth users to internal system users
-- Provides stable identity reference for all domains
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,  -- Supabase Auth UUID (nullable for mock auth)
  role user_type NOT NULL,  -- Uses existing user_type ENUM
  display_name VARCHAR(255) NOT NULL,
  organization_id UUID,  -- For university users (nullable)
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'User identity mapping - bridges Supabase Auth to internal system users';
COMMENT ON COLUMN users.auth_user_id IS 'Supabase Auth UUID - nullable until real auth is enabled';
COMMENT ON COLUMN users.role IS 'User role - determines intent (student, university, admin)';
COMMENT ON COLUMN users.organization_id IS 'Organization ID for university users - nullable';
COMMENT ON COLUMN users.status IS 'User status - active or suspended (soft disable)';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_users_auth_user_id ON users(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_organization_id ON users(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for updated_at timestamp
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Ensure organization_id is only set for university users
-- Note: This constraint is enforced at application level for now
-- Database-level constraint would require a function trigger
