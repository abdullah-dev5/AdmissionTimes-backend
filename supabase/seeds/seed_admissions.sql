-- ============================================================================
-- Seed Admissions Data
-- ============================================================================
--
-- Purpose: Seeds realistic admission records for testing and development
-- University User ID: 16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42
-- University Email: university@test.com
--
-- IMPORTANT: This script automatically fetches the organization_id from the
-- university user and uses it as university_id for all admissions.
-- This ensures proper foreign key relationships.
--
-- Usage:
--   psql -U postgres -d admissiontimes -f supabase/seeds/seed_admissions.sql
--
-- ============================================================================

-- Fetch the university user's organization_id to use as university_id
DO $$
DECLARE
  v_university_id UUID;
  v_created_by UUID := '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
BEGIN
  -- Get the organization_id from the university user
  SELECT organization_id INTO v_university_id
  FROM users
  WHERE id = v_created_by AND role = 'university';

  -- If organization_id is NULL, generate one and update the user
  IF v_university_id IS NULL THEN
    v_university_id := gen_random_uuid();
    
    UPDATE users
    SET organization_id = v_university_id,
        updated_at = NOW()
    WHERE id = v_created_by;
    
    RAISE NOTICE 'Generated and assigned organization_id: % to user %', v_university_id, v_created_by;
  ELSE
    RAISE NOTICE 'Using existing organization_id: % from user %', v_university_id, v_created_by;
  END IF;
  
  -- Insert admission records
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
  -- 1. BSCS Fall 2025 - Pending Verification
  (
    gen_random_uuid(),
    v_university_id, -- Use the organization_id from user
    'Bachelor of Science in Computer Science - Fall 2025',
    'A comprehensive 4-year program in Computer Science covering software engineering, algorithms, data structures, artificial intelligence, and more. Accredited by ABET.',
    'undergraduate',
    'bachelor',
    'Computer Science',
    '4 years',
    50000.00,
    'USD',
    100.00,
    '2025-07-15 23:59:59+00',
    '2025-09-01',
    'Stanford, California, USA',
    'on-campus',
    '{"gpa": "3.5/4.0", "test_scores": ["SAT 1400+", "ACT 30+"], "english": "TOEFL 100 or IELTS 7.0", "documents": ["High School Transcript", "Letters of Recommendation (3)", "Personal Statement", "Resume"]}'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 2. MBA Executive - Verified
  (
    gen_random_uuid(),
    v_university_id,
    'Executive MBA Program',
    'An intensive 2-year Executive MBA program designed for working professionals. Weekend classes with international immersion opportunities.',
    'graduate',
    'master',
    'Business Administration',
    '2 years',
    75000.00,
    'USD',
    150.00,
    '2025-08-10 23:59:59+00',
    '2025-10-01',
    'Cambridge, Massachusetts, USA',
    'hybrid',
    '{"work_experience": "5+ years management experience", "gpa": "3.0/4.0", "test_scores": ["GMAT 650+", "GRE 320+"], "documents": ["Bachelor Degree Transcript", "Letters of Recommendation (2)", "Resume", "Essay Questions (3)"]}'::jsonb,
    'verified',
    NOW() - INTERVAL '2 days',
    NULL, -- Admin user ID would go here
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 3. MS Data Science - Rejected
  (
    gen_random_uuid(),
    v_university_id,
    'Master of Science in Data Science',
    'Advanced program focusing on machine learning, big data analytics, statistical modeling, and data visualization.',
    'graduate',
    'master',
    'Data Science',
    '2 years',
    60000.00,
    'USD',
    100.00,
    '2025-06-30 23:59:59+00',
    '2025-08-15',
    'Berkeley, California, USA',
    'on-campus',
    '{"gpa": "3.3/4.0", "background": "Computer Science or related field", "test_scores": ["GRE 315+"], "documents": ["Transcript", "SOP", "LOR (3)", "Resume"]}'::jsonb,
    'rejected',
    NOW() - INTERVAL '1 day',
    NULL,
    'Incomplete documentation - missing program accreditation details',
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 4. PhD Physics - Pending Verification
  (
    gen_random_uuid(),
    v_university_id,
    'Doctor of Philosophy in Physics',
    'Research-focused doctoral program in theoretical and experimental physics. Full funding available for qualified candidates.',
    'graduate',
    'phd',
    'Physics',
    '5-6 years',
    0.00, -- Fully funded
    'USD',
    75.00,
    '2025-09-01 23:59:59+00',
    '2026-01-15',
    'Princeton, New Jersey, USA',
    'on-campus',
    '{"gpa": "3.5/4.0", "background": "Master degree in Physics or related field", "test_scores": ["GRE Physics Subject Test"], "research": "Research proposal required", "documents": ["Transcripts", "Research Proposal", "LOR (3)", "CV", "Writing Sample"]}'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 5. BBA Honors - Disputed
  (
    gen_random_uuid(),
    v_university_id,
    'Bachelor of Business Administration - Honors Program',
    'Selective honors program in Business Administration with specialized tracks in Finance, Marketing, and Entrepreneurship.',
    'undergraduate',
    'bachelor',
    'Business Administration',
    '4 years',
    45000.00,
    'USD',
    100.00,
    '2025-07-20 23:59:59+00',
    '2025-09-10',
    'Philadelphia, Pennsylvania, USA',
    'on-campus',
    '{"gpa": "3.7/4.0", "test_scores": ["SAT 1350+", "ACT 29+"], "honors": "High school honors program completion", "documents": ["Transcript", "LOR (2)", "Essay", "Activities Resume"]}'::jsonb,
    'disputed',
    NOW() - INTERVAL '3 days',
    NULL,
    NULL,
    'Program duration discrepancy - university claims 3.5 years flexible completion',
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 6. MS Artificial Intelligence - Draft
  (
    gen_random_uuid(),
    v_university_id,
    'Master of Science in Artificial Intelligence',
    'Cutting-edge program in AI, deep learning, computer vision, and natural language processing.',
    'graduate',
    'master',
    'Artificial Intelligence',
    '2 years',
    65000.00,
    'USD',
    100.00,
    '2025-08-01 23:59:59+00',
    '2025-09-15',
    'Seattle, Washington, USA',
    'hybrid',
    '{"gpa": "3.5/4.0", "background": "Computer Science, Mathematics, or Engineering", "programming": "Proficiency in Python required", "documents": ["Transcripts", "SOP", "LOR (3)", "Portfolio (optional)"]}'::jsonb,
    'draft',
    NULL,
    NULL,
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 7. MBA Digital Marketing - Verified
  (
    gen_random_uuid(),
    v_university_id,
    'MBA in Digital Marketing',
    'Specialized MBA focusing on digital marketing strategies, social media marketing, SEO/SEM, and marketing analytics.',
    'graduate',
    'master',
    'Marketing',
    '2 years',
    55000.00,
    'USD',
    125.00,
    '2025-07-25 23:59:59+00',
    '2025-09-20',
    'Austin, Texas, USA',
    'online',
    '{"work_experience": "2+ years in marketing or related field", "gpa": "3.0/4.0", "test_scores": ["GMAT 600+ (optional)"], "documents": ["Degree Certificate", "Resume", "SOP", "LOR (2)"]}'::jsonb,
    'verified',
    NOW() - INTERVAL '5 days',
    NULL,
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 8. BSc Mechanical Engineering - Pending
  (
    gen_random_uuid(),
    v_university_id,
    'Bachelor of Science in Mechanical Engineering',
    'ABET-accredited program in Mechanical Engineering with hands-on labs and co-op opportunities.',
    'undergraduate',
    'bachelor',
    'Mechanical Engineering',
    '4 years',
    48000.00,
    'USD',
    100.00,
    '2025-06-15 23:59:59+00',
    '2025-08-25',
    'Ann Arbor, Michigan, USA',
    'on-campus',
    '{"gpa": "3.3/4.0", "test_scores": ["SAT Math 700+", "ACT 28+"], "background": "Strong math and physics background", "documents": ["Transcript", "LOR (2)", "Personal Statement"]}'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 9. MS Cybersecurity - Verified
  (
    gen_random_uuid(),
    v_university_id,
    'Master of Science in Cybersecurity',
    'Comprehensive program covering network security, cryptography, ethical hacking, and security management.',
    'graduate',
    'master',
    'Cybersecurity',
    '2 years',
    58000.00,
    'USD',
    100.00,
    '2025-07-10 23:59:59+00',
    '2025-09-05',
    'College Park, Maryland, USA',
    'on-campus',
    '{"gpa": "3.2/4.0", "background": "Computer Science, IT, or Engineering", "certifications": "Security+ or equivalent (preferred)", "documents": ["Transcripts", "SOP", "LOR (3)", "Resume"]}'::jsonb,
    'verified',
    NOW() - INTERVAL '1 day',
    NULL,
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  ),
  
  -- 10. PhD Economics - Pending
  (
    gen_random_uuid(),
    v_university_id,
    'Doctor of Philosophy in Economics',
    'Research doctorate in Economics with specializations in Microeconomics, Macroeconomics, and Econometrics. Full funding package.',
    'graduate',
    'phd',
    'Economics',
    '5 years',
    0.00,
    'USD',
    75.00,
    '2025-12-15 23:59:59+00',
    '2026-08-15',
    'Chicago, Illinois, USA',
    'on-campus',
    '{"gpa": "3.7/4.0", "background": "Master in Economics or related field", "test_scores": ["GRE Quantitative 165+"], "math": "Advanced mathematics and statistics required", "documents": ["Transcripts", "Research Statement", "Writing Sample", "LOR (3)", "CV"]}'::jsonb,
    'pending',
    NULL,
    NULL,
    NULL,
    NULL,
    '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42',
    true
  );

  -- Output success message
  RAISE NOTICE '';
  RAISE NOTICE 'Successfully created 10 admission records';
  RAISE NOTICE 'University ID used: %', v_university_id;
  RAISE NOTICE '';
END $$;

-- Verify the seed
SELECT 
  id,
  title,
  program_type,
  degree_level,
  verification_status,
  deadline,
  tuition_fee,
  currency
FROM admissions
WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42'
ORDER BY created_at DESC;

-- Statistics
DO $$
DECLARE
  total_count INTEGER;
  pending_count INTEGER;
  verified_count INTEGER;
  rejected_count INTEGER;
  disputed_count INTEGER;
  draft_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count 
  FROM admissions 
  WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42';
  
  SELECT COUNT(*) INTO pending_count 
  FROM admissions 
  WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42' 
  AND verification_status = 'pending';
  
  SELECT COUNT(*) INTO verified_count 
  FROM admissions 
  WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42' 
  AND verification_status = 'verified';
  
  SELECT COUNT(*) INTO rejected_count 
  FROM admissions 
  WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42' 
  AND verification_status = 'rejected';
  
  SELECT COUNT(*) INTO disputed_count 
  FROM admissions 
  WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42' 
  AND verification_status = 'disputed';
  
  SELECT COUNT(*) INTO draft_count 
  FROM admissions 
  WHERE created_by = '16c7989e-3408-4ab3-b9bf-b2bcf7e1ab42' 
  AND verification_status = 'draft';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Admissions Seeding Complete!';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total Admissions: %', total_count;
  RAISE NOTICE '  - Pending: %', pending_count;
  RAISE NOTICE '  - Verified: %', verified_count;
  RAISE NOTICE '  - Rejected: %', rejected_count;
  RAISE NOTICE '  - Disputed: %', disputed_count;
  RAISE NOTICE '  - Draft: %', draft_count;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
END $$;
