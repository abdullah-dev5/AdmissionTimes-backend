/**
 * Enhanced Admissions Seed
 * 
 * Comprehensive seed data based on frontend mock data.
 * Includes detailed program information, eligibility, dates, and fee structures.
 * 
 * This seed file incorporates all the rich data from the frontend mock programs.
 */

import { query } from '../../../src/database/connection';
import { executeInTransaction } from './utils';
import { SeedResult } from './types';

/**
 * Enhanced admission data based on mock programs
 * Maps frontend mock data to database schema
 */
const ENHANCED_ADMISSIONS_DATA = [
  // BS Computer Science - Global Tech University
  {
    title: 'BS Computer Science',
    description: 'The BS in Computer Science at Global Tech University is a flagship program designed to equip students with the foundational knowledge and practical skills required to excel in the ever-evolving field of technology. Our curriculum is a blend of theoretical computer science principles and hands-on experience with the latest technologies and programming languages.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Computer Science',
    duration: '4 years',
    tuition_fee: 1225000, // Rs. 1,225,000 total program fee
    currency: 'PKR',
    application_fee: 25000, // Rs. 25,000 admission fee
    deadline: new Date('2026-03-15'),
    start_date: '2026-09-01',
    location: 'Lahore, Punjab',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: [
        'F.Sc (Pre-Engineering) or equivalent with minimum 60% marks',
        'A-Levels with minimum 3 subjects including Mathematics',
        'High School Diploma with Mathematics and Physics',
      ],
      documents: [
        'Matriculation certificate',
        'Intermediate/F.Sc certificate',
        'CNIC/B-Form copy',
        'Recent passport size photographs',
        'Entry test result',
        'Character certificate',
      ],
      entryTest: 'University\'s own entry test is mandatory. No external tests accepted.',
      applicationWindow: 'Open until January 15, 2026.',
      highlights: [
        'State-of-the-art labs with modern computing facilities.',
        'Curriculum designed in collaboration with industry leaders.',
        'Specialization tracks in AI, Cybersecurity, and Software Engineering.',
        'Mandatory internship program with partner tech companies.',
      ],
      importantDates: {
        applicationStart: '2025-11-01',
        applicationEnd: '2026-01-15',
        entryTestDate: '2026-02-10',
        resultDate: '2026-02-25',
      },
      feeStructure: {
        admissionFee: 'Rs. 25,000',
        semesterFee: 'Rs. 150,000',
        totalProgramFee: 'Rs. 1,225,000',
      },
    },
    verification_status: 'verified',
    verified_at: new Date('2025-11-05'),
    is_active: true,
  },
  
  // MBA - LUMS
  {
    title: 'MBA',
    description: 'The MBA program at LUMS is designed to develop leaders who can navigate complex business challenges. The program combines rigorous academic training with real-world business experience, preparing graduates for leadership roles in diverse industries.',
    program_type: 'graduate',
    degree_level: 'master',
    field_of_study: 'Business Administration',
    duration: '2 years',
    tuition_fee: 3650000, // Rs. 3,650,000 total program fee
    currency: 'PKR',
    application_fee: 50000, // Rs. 50,000 admission fee
    deadline: new Date('2026-01-20'),
    start_date: '2026-08-15',
    location: 'Lahore, Punjab',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: [
        '16 years of education (Bachelor\'s degree)',
        'Minimum 2.5 CGPA or 50% marks',
        'GMAT or LUMS admission test',
        'Work experience preferred but not mandatory',
      ],
      documents: [
        'Bachelor\'s degree transcript',
        'CNIC copy',
        'GMAT/LUMS test result',
        'Two recommendation letters',
        'Statement of purpose',
        'Work experience certificate (if applicable)',
      ],
      entryTest: 'GMAT or LUMS admission test required.',
      applicationWindow: 'Closing on January 20, 2026.',
      highlights: [
        'Internationally recognized AACSB accredited program.',
        'Strong industry connections and placement support.',
        'Diverse student body with global perspectives.',
        'Experienced faculty with industry and academic expertise.',
      ],
      importantDates: {
        applicationStart: '2025-10-01',
        applicationEnd: '2026-01-20',
        entryTestDate: '2026-02-15',
        resultDate: '2026-03-01',
      },
      feeStructure: {
        admissionFee: 'Rs. 50,000',
        semesterFee: 'Rs. 450,000',
        totalProgramFee: 'Rs. 3,650,000',
      },
    },
    verification_status: 'verified',
    verified_at: new Date('2025-11-03'),
    is_active: true,
  },
  
  // MD Medicine - Aga Khan University
  {
    title: 'MD Medicine',
    description: 'The MD Medicine program at Aga Khan University provides comprehensive training in internal medicine, preparing physicians for advanced clinical practice and research. The program emphasizes evidence-based medicine and patient-centered care.',
    program_type: 'graduate',
    degree_level: 'master',
    field_of_study: 'Medicine',
    duration: '4 years',
    tuition_fee: 4900000, // Rs. 4,900,000 total program fee
    currency: 'PKR',
    application_fee: 100000, // Rs. 100,000 admission fee
    deadline: new Date('2026-04-01'),
    start_date: '2026-08-01',
    location: 'Karachi, Sindh',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: [
        'MBBS degree from recognized institution',
        'Minimum 60% marks in MBBS',
        'Valid PMDC registration',
        'AKU entrance examination',
      ],
      documents: [
        'MBBS degree certificate',
        'PMDC registration certificate',
        'CNIC copy',
        'Medical transcripts',
        'AKU entrance test result',
        'Character certificate',
      ],
      entryTest: 'AKU entrance examination required.',
      applicationWindow: 'Open until March 15, 2026.',
      highlights: [
        'World-class medical facilities and teaching hospitals.',
        'Internationally recognized faculty and research opportunities.',
        'Comprehensive clinical training program.',
        'Strong emphasis on research and evidence-based practice.',
      ],
      importantDates: {
        applicationStart: '2025-11-01',
        applicationEnd: '2026-03-15',
        entryTestDate: '2026-03-25',
        resultDate: '2026-04-10',
      },
      feeStructure: {
        admissionFee: 'Rs. 100,000',
        semesterFee: 'Rs. 600,000',
        totalProgramFee: 'Rs. 4,900,000',
      },
    },
    verification_status: 'verified',
    verified_at: new Date('2025-11-01'),
    is_active: true,
  },
  
  // BBA - IBA Karachi
  {
    title: 'BBA',
    description: 'The BBA program at IBA Karachi is designed to develop business leaders with strong analytical and decision-making skills. The program provides a solid foundation in business fundamentals while encouraging critical thinking and innovation.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Business Administration',
    duration: '4 years',
    tuition_fee: 1470000, // Rs. 1,470,000 total program fee
    currency: 'PKR',
    application_fee: 30000, // Rs. 30,000 admission fee
    deadline: new Date('2026-02-28'),
    start_date: '2026-09-01',
    location: 'Karachi, Sindh',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: [
        'Intermediate or equivalent with minimum 60% marks',
        'A-Levels with minimum 3 subjects',
        'IBA admission test (NTS)',
      ],
      documents: [
        'Matriculation certificate',
        'Intermediate certificate',
        'CNIC/B-Form copy',
        'NTS test result',
        'Recent photographs',
        'Character certificate',
      ],
      entryTest: 'IBA admission test (NTS) required.',
      applicationWindow: 'Open until February 15, 2026.',
      highlights: [
        'Pakistan\'s premier business school with excellent reputation.',
        'Strong industry connections and internship opportunities.',
        'Modern curriculum aligned with global business practices.',
        'Excellent placement record with top companies.',
      ],
      importantDates: {
        applicationStart: '2025-11-01',
        applicationEnd: '2026-02-15',
        entryTestDate: '2026-02-20',
        resultDate: '2026-03-05',
      },
      feeStructure: {
        admissionFee: 'Rs. 30,000',
        semesterFee: 'Rs. 180,000',
        totalProgramFee: 'Rs. 1,470,000',
      },
    },
    verification_status: 'verified',
    verified_at: new Date('2025-10-30'),
    is_active: true,
  },
  
  // BS Software Engineering - National University of IT
  {
    title: 'BS Software Engineering',
    description: 'The BS Software Engineering program at National University of IT focuses on developing software systems and applications. Students learn modern software development practices, project management, and software engineering principles.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Software Engineering',
    duration: '4 years',
    tuition_fee: 1140000, // Rs. 1,140,000 total program fee
    currency: 'PKR',
    application_fee: 20000, // Rs. 20,000 admission fee
    deadline: new Date('2026-03-10'),
    start_date: '2026-09-01',
    location: 'Islamabad, Capital',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: [
        'F.Sc (Pre-Engineering) with minimum 65% marks',
        'A-Levels with Mathematics and Physics',
        'NUIT entrance test',
      ],
      documents: [
        'Matriculation certificate',
        'F.Sc certificate',
        'CNIC copy',
        'NUIT test result',
        'Photographs',
        'Character certificate',
      ],
      entryTest: 'NUIT entrance test required.',
      applicationWindow: 'Open until February 28, 2026.',
      highlights: [
        'Industry-focused curriculum with latest technologies.',
        'Strong emphasis on practical projects and internships.',
        'Collaboration with leading tech companies.',
        'Modern labs and development facilities.',
      ],
      importantDates: {
        applicationStart: '2025-11-01',
        applicationEnd: '2026-02-28',
        entryTestDate: '2026-03-05',
        resultDate: '2026-03-20',
      },
      feeStructure: {
        admissionFee: 'Rs. 20,000',
        semesterFee: 'Rs. 140,000',
        totalProgramFee: 'Rs. 1,140,000',
      },
    },
    verification_status: 'verified',
    verified_at: new Date('2025-11-04'),
    is_active: true,
  },
  
  // BS Data Science - Metropolitan Science College
  {
    title: 'BS Data Science',
    description: 'The BS Data Science program prepares students for careers in data analysis, machine learning, and artificial intelligence. The curriculum covers statistics, programming, data visualization, and advanced analytics techniques.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Data Science',
    duration: '4 years',
    tuition_fee: 1305000, // Rs. 1,305,000 total program fee
    currency: 'PKR',
    application_fee: 25000, // Rs. 25,000 admission fee
    deadline: new Date('2026-01-25'),
    start_date: '2026-09-01',
    location: 'Karachi, Sindh',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: [
        'F.Sc (Pre-Engineering) with minimum 60% marks',
        'Strong background in Mathematics',
        'MSC entrance test',
      ],
      documents: [
        'Matriculation certificate',
        'F.Sc certificate',
        'CNIC copy',
        'MSC test result',
        'Photographs',
        'Character certificate',
      ],
      entryTest: 'MSC entrance test required.',
      applicationWindow: 'Closing on January 25, 2026.',
      highlights: [
        'Cutting-edge curriculum in data science and AI.',
        'Hands-on experience with real-world datasets.',
        'Industry partnerships for internships and projects.',
        'Expert faculty with research and industry experience.',
      ],
      importantDates: {
        applicationStart: '2025-10-15',
        applicationEnd: '2026-01-25',
        entryTestDate: '2026-02-05',
        resultDate: '2026-02-20',
      },
      feeStructure: {
        admissionFee: 'Rs. 25,000',
        semesterFee: 'Rs. 160,000',
        totalProgramFee: 'Rs. 1,305,000',
      },
    },
    verification_status: 'pending',
    is_active: true,
  },
  
  // BS Artificial Intelligence - Lahore Engineering University (Closed)
  {
    title: 'BS Artificial Intelligence',
    description: 'The BS Artificial Intelligence program focuses on machine learning, neural networks, and intelligent systems. Students learn to develop AI solutions for real-world problems and gain expertise in cutting-edge AI technologies.',
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Artificial Intelligence',
    duration: '4 years',
    tuition_fee: 1390000, // Rs. 1,390,000 total program fee
    currency: 'PKR',
    application_fee: 30000, // Rs. 30,000 admission fee
    deadline: new Date('2025-12-15'), // Past deadline
    start_date: '2026-01-15',
    location: 'Lahore, Punjab',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: [
        'F.Sc (Pre-Engineering) with minimum 70% marks',
        'Strong Mathematics background',
        'LEU entrance test',
      ],
      documents: [
        'Matriculation certificate',
        'F.Sc certificate',
        'CNIC copy',
        'LEU test result',
        'Photographs',
        'Character certificate',
      ],
      entryTest: 'LEU entrance test was required.',
      applicationWindow: 'Application period has closed.',
      highlights: [
        'Comprehensive AI and machine learning curriculum.',
        'State-of-the-art AI labs and computing resources.',
        'Research opportunities in AI and robotics.',
        'Industry collaborations with tech companies.',
      ],
      importantDates: {
        applicationStart: '2025-09-01',
        applicationEnd: '2025-12-15',
        entryTestDate: '2025-12-20',
        resultDate: '2026-01-05',
      },
      feeStructure: {
        admissionFee: 'Rs. 30,000',
        semesterFee: 'Rs. 170,000',
        totalProgramFee: 'Rs. 1,390,000',
      },
    },
    verification_status: 'verified',
    verified_at: new Date('2025-10-28'),
    is_active: false, // Closed admission
  },
];

/**
 * Seed enhanced admissions table
 * This creates comprehensive admission records with detailed information
 */
export async function seedEnhancedAdmissions(): Promise<SeedResult> {
  return executeInTransaction(async () => {
    let insertedCount = 0;
    
    for (const admission of ENHANCED_ADMISSIONS_DATA) {
      try {
        const result = await query(
          `INSERT INTO admissions (
            title, description, program_type, degree_level, field_of_study,
            duration, tuition_fee, currency, application_fee, deadline, start_date,
            location, delivery_mode, requirements, verification_status,
            verified_at, is_active
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
          ON CONFLICT DO NOTHING
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
      seedName: 'enhanced-admissions',
      success: true,
      recordCount: insertedCount,
    };
  });
}
