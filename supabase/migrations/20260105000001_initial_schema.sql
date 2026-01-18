-- Migration: Initial Database Schema
-- Created: 2026-01-05
-- Description: Creates all tables, ENUMs, indexes, and triggers for AdmissionTimes backend

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Verification status for admissions
CREATE TYPE verification_status AS ENUM (
  'draft',
  'pending',
  'verified',
  'rejected',
  'disputed'
);

-- User types
CREATE TYPE user_type AS ENUM (
  'student',
  'university',
  'admin'
);

-- Notification categories
CREATE TYPE notification_category AS ENUM (
  'verification',
  'deadline',
  'system',
  'update'
);

-- Notification priorities
CREATE TYPE notification_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Change action types for changelogs
CREATE TYPE change_action_type AS ENUM (
  'created',
  'updated',
  'verified',
  'rejected',
  'disputed',
  'status_changed'
);

-- Actor types for changelogs
CREATE TYPE actor_type AS ENUM (
  'admin',
  'university',
  'system'
);

-- Deadline types
CREATE TYPE deadline_type AS ENUM (
  'application',
  'document_submission',
  'payment',
  'other'
);

-- Activity types for user activity
CREATE TYPE activity_type AS ENUM (
  'viewed',
  'searched',
  'compared',
  'watchlisted'
);

-- Analytics event types
CREATE TYPE analytics_event_type AS ENUM (
  'admission_viewed',
  'admission_created',
  'verification_completed',
  'verification_rejected',
  'deadline_approaching',
  'search_performed',
  'comparison_made'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Admissions table (CORE DATA)
-- Single source of truth for admission records
CREATE TABLE admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID, -- Future: foreign key to universities table
  title VARCHAR(255) NOT NULL,
  description TEXT,
  program_type VARCHAR(100), -- e.g., undergraduate, graduate, certificate
  degree_level VARCHAR(100), -- e.g., bachelor, master, phd
  field_of_study VARCHAR(255),
  duration VARCHAR(100), -- e.g., "4 years"
  tuition_fee DECIMAL(12, 2),
  currency VARCHAR(3), -- ISO currency code
  application_fee DECIMAL(10, 2),
  deadline TIMESTAMP WITH TIME ZONE,
  start_date DATE,
  location VARCHAR(255),
  delivery_mode VARCHAR(50), -- e.g., on-campus, online, hybrid
  requirements JSONB, -- Flexible structure for requirements
  verification_status verification_status NOT NULL DEFAULT 'draft',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID, -- Future: foreign key to admin users
  rejection_reason TEXT,
  dispute_reason TEXT,
  created_by UUID, -- Future: foreign key to university users
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE admissions IS 'Core admission/program records created by universities';
COMMENT ON COLUMN admissions.verification_status IS 'Current verification state: draft, pending, verified, rejected, or disputed';
COMMENT ON COLUMN admissions.requirements IS 'Flexible JSONB structure for admission requirements';
COMMENT ON COLUMN admissions.is_active IS 'Soft delete flag - false means admission is deleted';

-- Changelogs table (IMMUTABLE AUDIT TRAIL)
-- Immutable audit trail for all changes
CREATE TABLE changelogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  actor_type actor_type NOT NULL,
  changed_by UUID, -- Future: foreign key to users
  action_type change_action_type NOT NULL,
  field_name VARCHAR(100), -- Which field changed (null for status changes)
  old_value JSONB, -- Previous value
  new_value JSONB, -- New value
  diff_summary TEXT, -- Pre-computed human-readable summary
  metadata JSONB, -- Additional context (IP, user agent, etc.)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE changelogs IS 'Immutable audit trail - never updated or deleted';
COMMENT ON COLUMN changelogs.old_value IS 'Previous value stored as JSONB for flexibility';
COMMENT ON COLUMN changelogs.new_value IS 'New value stored as JSONB for flexibility';
COMMENT ON COLUMN changelogs.diff_summary IS 'Pre-computed human-readable change summary';

-- Deadlines table
-- Deadline management with urgency calculation
CREATE TABLE deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  deadline_type deadline_type NOT NULL,
  deadline_date TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC', -- ISO timezone
  is_flexible BOOLEAN NOT NULL DEFAULT false,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE deadlines IS 'Admission deadlines with calculated urgency';
COMMENT ON COLUMN deadlines.deadline_type IS 'Type of deadline: application, document_submission, payment, or other';
COMMENT ON COLUMN deadlines.reminder_sent IS 'Tracks if reminder notification has been sent';

-- Notifications table (VOLATILE DATA)
-- User-facing alerts
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Future: foreign key to users
  user_type user_type NOT NULL,
  category notification_category NOT NULL,
  priority notification_priority NOT NULL DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_entity_type VARCHAR(100), -- e.g., "admission", "verification"
  related_entity_id UUID, -- e.g., admission_id
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  action_url VARCHAR(500), -- Frontend route for navigation
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'User-facing notifications - time-bounded, paginated access';
COMMENT ON COLUMN notifications.user_id IS 'Nullable until authentication is implemented';
COMMENT ON COLUMN notifications.action_url IS 'Frontend route to navigate when notification is clicked';

-- User Activity table (ACTIVITY DATA)
-- Recent activity feed and recommendation foundation
CREATE TABLE user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Future: foreign key to users
  user_type user_type NOT NULL,
  activity_type activity_type NOT NULL,
  entity_type VARCHAR(100) NOT NULL, -- e.g., "admission"
  entity_id UUID NOT NULL,
  metadata JSONB, -- Minimal metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_activity IS 'Recent activity tracking - trimmed by query, not delete job';
COMMENT ON COLUMN user_activity.metadata IS 'Minimal metadata JSONB for activity context';

-- Analytics Events table (ANALYTICS DATA)
-- Minimal system analytics
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type analytics_event_type NOT NULL,
  entity_type VARCHAR(100), -- e.g., "admission"
  entity_id UUID,
  user_type user_type, -- Can be null for anonymous events
  user_id UUID, -- Future: foreign key to users
  metadata JSONB, -- Minimal context
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE analytics_events IS 'Minimal system analytics - append-only, aggregated on demand';
COMMENT ON COLUMN analytics_events.metadata IS 'Minimal metadata for event context';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Admissions indexes (7 indexes)
CREATE INDEX idx_admissions_verification_status ON admissions(verification_status);
CREATE INDEX idx_admissions_university_id ON admissions(university_id) WHERE university_id IS NOT NULL;
CREATE INDEX idx_admissions_created_at ON admissions(created_at DESC);
CREATE INDEX idx_admissions_is_active ON admissions(is_active) WHERE is_active = true;
CREATE INDEX idx_admissions_verified_at ON admissions(verified_at DESC) WHERE verified_at IS NOT NULL;
-- Composite index for common queries
CREATE INDEX idx_admissions_status_active ON admissions(verification_status, is_active) WHERE is_active = true;
-- Full-text search index
CREATE INDEX idx_admissions_search ON admissions USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Changelogs indexes (4 indexes)
CREATE INDEX idx_changelogs_admission_id ON changelogs(admission_id);
CREATE INDEX idx_changelogs_created_at ON changelogs(created_at DESC);
CREATE INDEX idx_changelogs_action_type ON changelogs(action_type);
CREATE INDEX idx_changelogs_admission_created ON changelogs(admission_id, created_at DESC);

-- Deadlines indexes (4 indexes)
CREATE INDEX idx_deadlines_admission_id ON deadlines(admission_id);
CREATE INDEX idx_deadlines_deadline_date ON deadlines(deadline_date);
CREATE INDEX idx_deadlines_type_date ON deadlines(deadline_type, deadline_date);
-- Composite index for upcoming deadlines (removed NOW() predicate as it's not immutable)
-- Note: Filter by deadline_date > CURRENT_TIMESTAMP in queries instead
CREATE INDEX idx_deadlines_upcoming ON deadlines(deadline_date, reminder_sent) WHERE reminder_sent = false;

-- Notifications indexes (5 indexes)
CREATE INDEX idx_notifications_user_id ON notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_notifications_user_type ON notifications(user_type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
-- Composite index for efficient queries
CREATE INDEX idx_notifications_user_read ON notifications(user_type, is_read, created_at DESC);

-- User Activity indexes (4 indexes)
CREATE INDEX idx_user_activity_user_id ON user_activity(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_activity_user_type ON user_activity(user_type);
CREATE INDEX idx_user_activity_created_at ON user_activity(created_at DESC);
CREATE INDEX idx_user_activity_entity ON user_activity(entity_type, entity_id);

-- Analytics Events indexes (4 indexes)
CREATE INDEX idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_entity ON analytics_events(entity_type, entity_id) WHERE entity_type IS NOT NULL;
CREATE INDEX idx_analytics_user_type ON analytics_events(user_type, created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for admissions table
CREATE TRIGGER update_admissions_updated_at
  BEFORE UPDATE ON admissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for deadlines table
CREATE TRIGGER update_deadlines_updated_at
  BEFORE UPDATE ON deadlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Ensure verified_at and verified_by are set together when verified
ALTER TABLE admissions ADD CONSTRAINT check_verified_fields
  CHECK (
    (verification_status = 'verified' AND verified_at IS NOT NULL) OR
    (verification_status != 'verified')
  );

-- Ensure rejection_reason is set when rejected
ALTER TABLE admissions ADD CONSTRAINT check_rejection_reason
  CHECK (
    (verification_status = 'rejected' AND rejection_reason IS NOT NULL) OR
    (verification_status != 'rejected')
  );

-- Ensure dispute_reason is set when disputed
ALTER TABLE admissions ADD CONSTRAINT check_dispute_reason
  CHECK (
    (verification_status = 'disputed' AND dispute_reason IS NOT NULL) OR
    (verification_status != 'disputed')
  );
