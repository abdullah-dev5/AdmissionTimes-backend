-- Seed Data for AdmissionTimes Backend
-- Created: 2026-01-05
-- Description: Optional seed data for development and testing
-- Note: This file is executed after migrations when running `supabase db reset`

-- ============================================================================
-- SAMPLE ADMISSIONS
-- ============================================================================

-- Example: Verified admission
INSERT INTO admissions (
  id,
  title,
  description,
  program_type,
  degree_level,
  field_of_study,
  duration,
  tuition_fee,
  currency,
  application_fee,
  deadline,
  start_date,
  location,
  delivery_mode,
  requirements,
  verification_status,
  verified_at,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Computer Science Bachelor Program',
  'A comprehensive 4-year undergraduate program in Computer Science covering fundamentals and advanced topics.',
  'undergraduate',
  'bachelor',
  'Computer Science',
  '4 years',
  15000.00,
  'USD',
  50.00,
  '2026-06-01 23:59:59+00',
  '2026-09-01',
  'New York, USA',
  'on-campus',
  '{"gpa": 3.0, "sat_score": 1200, "toefl": 80, "documents": ["transcript", "recommendation_letters"]}'::jsonb,
  'verified',
  NOW() - INTERVAL '5 days',
  true
);

-- Example: Pending admission
INSERT INTO admissions (
  id,
  title,
  description,
  program_type,
  degree_level,
  field_of_study,
  duration,
  tuition_fee,
  currency,
  application_fee,
  deadline,
  start_date,
  location,
  delivery_mode,
  requirements,
  verification_status,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'MBA Program',
  'Master of Business Administration program designed for working professionals.',
  'graduate',
  'master',
  'Business Administration',
  '2 years',
  30000.00,
  'USD',
  100.00,
  '2026-05-15 23:59:59+00',
  '2026-08-01',
  'Boston, USA',
  'hybrid',
  '{"gpa": 3.5, "gmat": 600, "work_experience": 2, "documents": ["transcript", "resume", "essay"]}'::jsonb,
  'pending',
  true
);

-- Example: Draft admission
INSERT INTO admissions (
  id,
  title,
  description,
  program_type,
  degree_level,
  field_of_study,
  duration,
  tuition_fee,
  currency,
  application_fee,
  deadline,
  start_date,
  location,
  delivery_mode,
  requirements,
  verification_status,
  is_active
) VALUES (
  '550e8400-e29b-41d4-a716-446655440003',
  'Data Science Certificate',
  '6-month certificate program in Data Science and Machine Learning.',
  'certificate',
  NULL,
  'Data Science',
  '6 months',
  5000.00,
  'USD',
  25.00,
  '2026-04-01 23:59:59+00',
  '2026-06-01',
  'Online',
  'online',
  '{"prerequisites": ["basic_programming", "statistics"], "documents": ["resume"]}'::jsonb,
  'draft',
  true
);

-- ============================================================================
-- SAMPLE DEADLINES
-- ============================================================================

INSERT INTO deadlines (
  admission_id,
  deadline_type,
  deadline_date,
  timezone,
  is_flexible,
  reminder_sent
) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'application', '2026-06-01 23:59:59+00', 'America/New_York', false, false),
  ('550e8400-e29b-41d4-a716-446655440001', 'document_submission', '2026-06-15 23:59:59+00', 'America/New_York', true, false),
  ('550e8400-e29b-41d4-a716-446655440002', 'application', '2026-05-15 23:59:59+00', 'America/New_York', false, false),
  ('550e8400-e29b-41d4-a716-446655440002', 'payment', '2026-05-20 23:59:59+00', 'America/New_York', false, false);

-- ============================================================================
-- SAMPLE CHANGELOGS
-- ============================================================================

-- Changelog for verified admission
INSERT INTO changelogs (
  admission_id,
  actor_type,
  action_type,
  field_name,
  old_value,
  new_value,
  diff_summary,
  metadata
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'admin',
  'verified',
  NULL,
  '{"status": "pending"}'::jsonb,
  '{"status": "verified"}'::jsonb,
  'Admission verified by admin',
  '{"admin_id": "admin-001", "verification_notes": "All requirements met"}'::jsonb
);

-- Changelog for status change
INSERT INTO changelogs (
  admission_id,
  actor_type,
  action_type,
  field_name,
  old_value,
  new_value,
  diff_summary,
  metadata
) VALUES (
  '550e8400-e29b-41d4-a716-446655440002',
  'university',
  'status_changed',
  'verification_status',
  '"draft"'::jsonb,
  '"pending"'::jsonb,
  'Status changed from draft to pending',
  '{"submitted_at": "2026-01-05T10:00:00Z"}'::jsonb
);

-- ============================================================================
-- SAMPLE NOTIFICATIONS
-- ============================================================================

INSERT INTO notifications (
  user_type,
  category,
  priority,
  title,
  message,
  related_entity_type,
  related_entity_id,
  is_read,
  action_url
) VALUES
  (
    'admin',
    'verification',
    'high',
    'New Admission Pending Review',
    'A new admission has been submitted and requires verification.',
    'admission',
    '550e8400-e29b-41d4-a716-446655440002',
    false,
    '/admin/verifications/550e8400-e29b-41d4-a716-446655440002'
  ),
  (
    'university',
    'verification',
    'medium',
    'Admission Verified',
    'Your admission "Computer Science Bachelor Program" has been verified and is now visible to students.',
    'admission',
    '550e8400-e29b-41d4-a716-446655440001',
    false,
    '/university/admissions/550e8400-e29b-41d4-a716-446655440001'
  );

-- ============================================================================
-- SAMPLE USER ACTIVITY
-- ============================================================================

INSERT INTO user_activity (
  user_type,
  activity_type,
  entity_type,
  entity_id,
  metadata
) VALUES
  (
    'student',
    'viewed',
    'admission',
    '550e8400-e29b-41d4-a716-446655440001',
    '{"view_duration": 45, "source": "search"}'::jsonb
  ),
  (
    'student',
    'searched',
    'admission',
    NULL,
    '{"query": "computer science", "results_count": 12}'::jsonb
  );

-- ============================================================================
-- SAMPLE ANALYTICS EVENTS
-- ============================================================================

INSERT INTO analytics_events (
  event_type,
  entity_type,
  entity_id,
  user_type,
  metadata
) VALUES
  (
    'admission_viewed',
    'admission',
    '550e8400-e29b-41d4-a716-446655440001',
    'student',
    '{"view_count": 1}'::jsonb
  ),
  (
    'admission_created',
    'admission',
    '550e8400-e29b-41d4-a716-446655440002',
    'university',
    '{"creation_method": "web_form"}'::jsonb
  ),
  (
    'verification_completed',
    'admission',
    '550e8400-e29b-41d4-a716-446655440001',
    'admin',
    '{"verification_time": 120}'::jsonb
  );

-- ============================================================================
-- NOTES
-- ============================================================================

-- This seed file provides sample data for development and testing.
-- To use seed data:
-- 1. Ensure seed.sql is in the supabase directory
-- 2. Run: npx supabase db reset
--
-- To disable seed data:
-- 1. Comment out or remove the INSERT statements above
-- 2. Or set seed.enabled = false in config.toml
