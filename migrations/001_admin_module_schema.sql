-- ============================================================================
-- ADMIN MODULE IMPLEMENTATION - DATABASE MIGRATIONS
-- File: migrations/001_admin_module_schema.sql
-- Date: February 9, 2026
-- Purpose: Add admin module tables and fields (BACKWARD COMPATIBLE)
-- ============================================================================

-- MIGRATION 1: Add Admin Fields to Admissions Table
-- ✅ ALL NEW COLUMNS ARE OPTIONAL (nullable) - Won't break existing data
-- ✅ Backward compatible - old queries continue to work

ALTER TABLE admissions 
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS verification_comments TEXT DEFAULT NULL;

-- Add indexes for admin queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_admissions_verified_by 
  ON admissions(verified_by);

CREATE INDEX IF NOT EXISTS idx_admissions_status_verified_at 
  ON admissions(verification_status, verified_at DESC);

-- MIGRATION 2: Create Admin Audit Logs Table
-- ✅ NEW TABLE - No impact on existing modules
-- ✅ Admin-only tracking of all verification actions

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'verify', 'reject', 'dispute', 'update_notes', 'bulk_verify'
  )),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
    'admission', 'user', 'university', 'settings'
  )),
  entity_id UUID NOT NULL,
  old_values JSONB DEFAULT NULL,
  new_values JSONB DEFAULT NULL,
  reason TEXT DEFAULT NULL,
  ip_address INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) DEFAULT 'system'
);

-- Indexes for admin queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id 
  ON admin_audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at 
  ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity 
  ON admin_audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action 
  ON admin_audit_logs(action_type);

-- ============================================================================
-- END OF MIGRATIONS
-- Status: SAFE - All changes are backward compatible
-- ============================================================================
