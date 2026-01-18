/**
 * Admissions Seed
 * 
 * Seeds the admissions table with sample admission records.
 * Creates various verification statuses, program types, and degree levels.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

/**
 * Sample admission data
 */
const ADMISSIONS_DATA = [
  // Verified Admissions
  {
    title: 'Bachelor of Computer Science',
    description: 'Comprehensive computer science program covering algorithms, data structures, software engineering, and more.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Computer Science',
    duration: '4 years',
    tuition_fee: 50000,
    currency: 'USD',
    application_fee: 100,
    deadline: new Date('2026-08-15'),
    start_date: '2026-09-01',
    location: 'New York, USA',
    delivery_mode: 'on-campus',
    requirements: { gpa: 3.0, sat_score: 1200, english_proficiency: true },
    verification_status: 'verified',
    verified_at: new Date('2026-01-10'),
    is_active: true,
  },
  {
    title: 'Master of Business Administration',
    description: 'Advanced MBA program for business professionals seeking leadership roles.',
    program_type: 'graduate',
    degree_level: 'master',
    field_of_study: 'Business Administration',
    duration: '2 years',
    tuition_fee: 75000,
    currency: 'USD',
    application_fee: 150,
    deadline: new Date('2026-07-01'),
    start_date: '2026-08-15',
    location: 'Boston, USA',
    delivery_mode: 'hybrid',
    requirements: { gpa: 3.5, work_experience: '2 years', gmat_score: 650 },
    verification_status: 'verified',
    verified_at: new Date('2026-01-08'),
    is_active: true,
  },
  {
    title: 'PhD in Engineering',
    description: 'Research-focused PhD program in various engineering disciplines.',
    program_type: 'graduate',
    degree_level: 'phd',
    field_of_study: 'Engineering',
    duration: '4-5 years',
    tuition_fee: 0, // Often funded
    currency: 'USD',
    application_fee: 200,
    deadline: new Date('2026-06-01'),
    start_date: '2026-09-01',
    location: 'California, USA',
    delivery_mode: 'on-campus',
    requirements: { gpa: 3.7, research_experience: true, recommendation_letters: 3 },
    verification_status: 'verified',
    verified_at: new Date('2026-01-05'),
    is_active: true,
  },
  {
    title: 'Certificate in Data Science',
    description: 'Intensive certificate program covering data analysis, machine learning, and visualization.',
    program_type: 'certificate',
    degree_level: 'certificate',
    field_of_study: 'Data Science',
    duration: '6 months',
    tuition_fee: 15000,
    currency: 'USD',
    application_fee: 50,
    deadline: new Date('2026-05-15'),
    start_date: '2026-06-01',
    location: 'Online',
    delivery_mode: 'online',
    requirements: { basic_programming: true, math_background: true },
    verification_status: 'verified',
    verified_at: new Date('2026-01-12'),
    is_active: true,
  },
  
  // Pending Admissions
  {
    title: 'Bachelor of Arts in Psychology',
    description: 'Comprehensive psychology program with focus on clinical and research applications.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Psychology',
    duration: '4 years',
    tuition_fee: 45000,
    currency: 'USD',
    application_fee: 100,
    deadline: new Date('2026-08-20'),
    start_date: '2026-09-01',
    location: 'Chicago, USA',
    delivery_mode: 'on-campus',
    requirements: { gpa: 2.8, sat_score: 1100 },
    verification_status: 'pending',
    is_active: true,
  },
  {
    title: 'Master of Science in Data Analytics',
    description: 'Advanced analytics program focusing on big data and business intelligence.',
    program_type: 'graduate',
    degree_level: 'master',
    field_of_study: 'Data Analytics',
    duration: '18 months',
    tuition_fee: 60000,
    currency: 'USD',
    application_fee: 125,
    deadline: new Date('2026-07-15'),
    start_date: '2026-08-15',
    location: 'Seattle, USA',
    delivery_mode: 'hybrid',
    requirements: { gpa: 3.2, technical_background: true },
    verification_status: 'pending',
    is_active: true,
  },
  
  // Rejected Admissions
  {
    title: 'Bachelor of Medicine',
    description: 'Medical degree program with clinical rotations.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Medicine',
    duration: '6 years',
    tuition_fee: 120000,
    currency: 'USD',
    application_fee: 200,
    deadline: new Date('2026-06-01'),
    start_date: '2026-08-01',
    location: 'Philadelphia, USA',
    delivery_mode: 'on-campus',
    requirements: { gpa: 3.8, mcat_score: 510 },
    verification_status: 'rejected',
    rejection_reason: 'Incomplete documentation and missing prerequisite courses.',
    is_active: false,
  },
  
  // Draft Admissions
  {
    title: 'Associate Degree in Nursing',
    description: 'Two-year nursing program preparing students for RN licensure.',
    program_type: 'undergraduate',
    degree_level: 'associate',
    field_of_study: 'Nursing',
    duration: '2 years',
    tuition_fee: 30000,
    currency: 'USD',
    application_fee: 75,
    deadline: new Date('2026-09-01'),
    start_date: '2026-10-01',
    location: 'Miami, USA',
    delivery_mode: 'on-campus',
    requirements: { gpa: 2.5, health_clearance: true },
    verification_status: 'draft',
    is_active: true,
  },
  {
    title: 'Online Master of Education',
    description: 'Flexible online program for working educators.',
    program_type: 'graduate',
    degree_level: 'master',
    field_of_study: 'Education',
    duration: '2 years',
    tuition_fee: 40000,
    currency: 'USD',
    application_fee: 100,
    deadline: new Date('2026-08-01'),
    start_date: '2026-09-15',
    location: 'Online',
    delivery_mode: 'online',
    requirements: { teaching_experience: '1 year', bachelor_degree: true },
    verification_status: 'draft',
    is_active: true,
  },
];

/**
 * Seed admissions table
 */
export async function seedAdmissions(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    let insertedCount = 0;
    
    for (const admission of ADMISSIONS_DATA) {
      try {
        const result = await query(
          `INSERT INTO admissions (
            title, description, program_type, degree_level, field_of_study,
            duration, tuition_fee, currency, application_fee, deadline, start_date,
            location, delivery_mode, requirements, verification_status,
            verified_at, rejection_reason, is_active
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
          )
          RETURNING id`,
          [
            admission.title,
            admission.description,
            admission.program_type,
            admission.degree_level,
            admission.field_of_study,
            admission.duration,
            admission.tuition_fee,
            admission.currency,
            admission.application_fee,
            admission.deadline,
            admission.start_date,
            admission.location,
            admission.delivery_mode,
            JSON.stringify(admission.requirements),
            admission.verification_status,
            admission.verified_at || null,
            admission.rejection_reason || null,
            admission.is_active,
          ]
        );
        
        if (result.rows.length > 0) {
          insertedCount++;
        }
      } catch (error: any) {
        // Log error but continue (might be duplicate)
        if (error.code !== '23505') { // Not a unique violation
          console.error(`   ⚠️  Error inserting admission "${admission.title}":`, error.message);
        }
      }
    }
    
    return {
      seedName: 'admissions',
      success: true,
      recordCount: insertedCount,
    };
  });
}
