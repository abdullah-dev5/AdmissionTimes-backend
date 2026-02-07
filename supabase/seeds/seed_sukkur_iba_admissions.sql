-- ============================================================================
-- Seed Admissions Data - Sukkur IBA University
-- ============================================================================
--
-- Purpose: Seeds 5 admission records for Sukkur IBA University
-- University User ID: 68edbfca-ac83-4b2f-b272-8847c1c9527f
-- University Email: university@test.com
-- Organization/University ID: 975a3939-986a-4824-9528-6d7265739cac
--
-- Usage:
--   psql -U postgres -d postgres -f supabase/seeds/seed_sukkur_iba_admissions.sql
--   OR from Supabase SQL Editor, paste and run this script
--
-- ============================================================================

-- Insert admission records for Sukkur IBA
INSERT INTO admissions (
  id,
  university_id,
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
  verified_by,
  rejection_reason,
  dispute_reason,
  created_by,
  is_active
) VALUES
  -- 1. BBA Fall 2026 - Pending Verification
  (
    gen_random_uuid(),
    '975a3939-986a-4824-9528-6d7265739cac',
    'Bachelor of Business Administration - Fall 2026',
    'A comprehensive 4-year BBA program at Sukkur IBA University covering management, finance, marketing, and entrepreneurship. Accredited by HEC Pakistan.',
    'undergraduate',
    'bachelor',
    'Business Administration',
    '4 years',
    450000.00,
    'PKR',
    5000.00,
    '2026-08-15 23:59:59+00',
    '2026-09-15',
    'Sukkur, Sindh, Pakistan',
    'on-campus',
    '{"gpa": "60% or equivalent", "test_scores": ["SAT", "NTS", "or University Entry Test"], "documents": ["Intermediate Certificate", "Domicile Copy", "CNIC/B-Form", "Character Certificate"]}'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '68edbfca-ac83-4b2f-b272-8847c1c9527f',
    true
  ),
  
  -- 2. BS Computer Science - Verified
  (
    gen_random_uuid(),
    '975a3939-986a-4824-9528-6d7265739cac',
    'BS in Computer Science - Spring 2027',
    'A rigorous 4-year Bachelor of Science program in Computer Science focusing on software development, algorithms, AI, and data science. NCEAC accredited.',
    'undergraduate',
    'bachelor',
    'Computer Science',
    '4 years',
    500000.00,
    'PKR',
    5000.00,
    '2027-01-20 23:59:59+00',
    '2027-02-15',
    'Sukkur, Sindh, Pakistan',
    'on-campus',
    '{"gpa": "70% in Mathematics and Computer Science", "test_scores": ["NTS-NAT or IBA Test"], "documents": ["Intermediate Certificate (Pre-Engineering/ICS)", "Transcript", "CNIC", "Photographs"]}'::jsonb,
    'verified',
    NOW() - INTERVAL '3 days',
    NULL,
    NULL,
    NULL,
    '68edbfca-ac83-4b2f-b272-8847c1c9527f',
    true
  ),
  
  -- 3. MBA Executive Evening Program - Verified
  (
    gen_random_uuid(),
    '975a3939-986a-4824-9528-6d7265739cac',
    'Executive MBA (Evening Program)',
    'A 2-year Executive MBA program designed for working professionals. Evening and weekend classes with focus on leadership, strategy, and innovation.',
    'graduate',
    'master',
    'Business Administration',
    '2 years',
    350000.00,
    'PKR',
    7500.00,
    '2026-07-30 23:59:59+00',
    '2026-09-01',
    'Sukkur, Sindh, Pakistan',
    'hybrid',
    '{"work_experience": "2+ years professional experience", "gpa": "2.5 CGPA in Bachelor", "test_scores": ["IBA Admission Test or GAT"], "documents": ["Bachelor Degree", "Transcript", "Work Experience Letter", "CNIC", "CV"]}'::jsonb,
    'verified',
    NOW() - INTERVAL '1 day',
    NULL,
    NULL,
    NULL,
    '68edbfca-ac83-4b2f-b272-8847c1c9527f',
    true
  ),
  
  -- 4. MS Economics - Pending Verification
  (
    gen_random_uuid(),
    '975a3939-986a-4824-9528-6d7265739cac',
    'MS in Economics - Fall 2026',
    'A 2-year Master of Science program in Economics with emphasis on econometrics, development economics, and policy analysis. Research-oriented curriculum.',
    'graduate',
    'master',
    'Economics',
    '2 years',
    280000.00,
    'PKR',
    6000.00,
    '2026-08-10 23:59:59+00',
    '2026-09-10',
    'Sukkur, Sindh, Pakistan',
    'on-campus',
    '{"gpa": "3.0 CGPA in Economics or related field", "test_scores": ["GAT General or IBA Test score 50%+"], "documents": ["BS/BA Degree", "Transcript", "Research Proposal", "2 Recommendation Letters", "CNIC"]}'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '68edbfca-ac83-4b2f-b272-8847c1c9527f',
    true
  ),
  
  -- 5. BS Mathematics - Pending Verification
  (
    gen_random_uuid(),
    '975a3939-986a-4824-9528-6d7265739cac',
    'BS in Mathematics - Fall 2026',
    'A 4-year Bachelor of Science program in Mathematics covering pure mathematics, applied mathematics, and mathematical modeling. Excellent pathway to research careers.',
    'undergraduate',
    'bachelor',
    'Mathematics',
    '4 years',
    420000.00,
    'PKR',
    5000.00,
    '2026-08-20 23:59:59+00',
    '2026-09-20',
    'Sukkur, Sindh, Pakistan',
    'on-campus',
    '{"gpa": "65% with Mathematics as major subject", "test_scores": ["IBA Entry Test or NTS-NAT"], "documents": ["Intermediate Certificate", "Detailed Marks Sheet", "CNIC", "Domicile", "Migration Certificate (if applicable)"]}'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '68edbfca-ac83-4b2f-b272-8847c1c9527f',
    true
  );

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully seeded 5 admission records for Sukkur IBA University';
  RAISE NOTICE '   University ID: 975a3939-986a-4824-9528-6d7265739cac';
  RAISE NOTICE '   Created by: 68edbfca-ac83-4b2f-b272-8847c1c9527f';
END $$;
