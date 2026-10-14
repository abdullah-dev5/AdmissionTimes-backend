/**
 * Admissions Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the admissions domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { VerificationStatus } from '@config/constants';
export type { UserContext } from '@shared/types/auth';

/**
 * Core admission record interface
 * Matches the database schema
 */
export interface Admission {
  id: string;
  university_id: string;
  university_name?: string | null;
  title: string;
  description: string | null;
  program_type: string | null;
  degree_level: string | null;
  field_of_study: string | null;
  duration: string | null;
  tuition_fee: number | null;
  currency: string | null;
  application_fee: number | null;
  deadline: string | null; // ISO8601 timestamp
  start_date: string | null; // ISO8601 date
  location: string | null;
  delivery_mode: string | null;
  requirements: Record<string, any> | null; // JSONB
  verification_status: VerificationStatus;
  verified_at: string | null; // ISO8601 timestamp
  verified_by: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
  is_active: boolean;
  dispute_reason?: string | null;
  admin_notes?: string | null;
  verification_comments?: string | null;
  needs_reverification?: boolean;
  updated_by?: string | null;
  data_origin?: string | null;
  source_system?: string | null;
  source_url?: string | null;
  source_record_hash?: string | null;
  source_last_seen_at?: string | null;
  ingestion_run_id?: string | null;

  // Phase 0 additive normalized contract fields
  contract_version?: number;
  degree_label?: string;
  degree_type?: string;
  deadline_iso?: string | null;
  days_remaining?: number;
  program_status?: 'Open' | 'Closing Soon' | 'Closed';
  fee_amount?: number;
  fee_display?: string;
  eligibility_text?: string | null;
  university_website_url?: string | null;
  admission_portal_url?: string | null;
  primary_apply_url?: string | null;
  status_label?: 'Verified' | 'Pending' | 'Closed' | 'Draft';
  match_label?: string;
}

/**
 * Create admission DTO (Data Transfer Object)
 * Used for creating new admissions
 */
export interface CreateAdmissionDTO {
  title: string;
  description?: string;
  program_type?: string;
  degree_level?: string;
  field_of_study?: string;
  duration?: string;
  tuition_fee?: number;
  currency?: string;
  application_fee?: number;
  deadline?: string; // ISO8601
  start_date?: string; // ISO8601
  location?: string;
  delivery_mode?: string;
  requirements?: Record<string, any>;
  /**
   * Submission intent from the client: 'draft' keeps the admission private,
   * 'pending' submits it for admin review. Never written as-is.
   */
  verification_status?: 'draft' | 'pending';
  /** Admin only: the university the admission belongs to. */
  university_id?: string;
}

/**
 * Update admission DTO
 * All fields optional for partial updates
 */
export interface UpdateAdmissionDTO extends Partial<CreateAdmissionDTO> {}

/**
 * Admission filter parameters
 * Used for filtering and searching admissions
 */
export interface AdmissionFilters {
  search?: string;
  program_type?: string;
  degree_level?: string;
  field_of_study?: string;
  location?: string;
  delivery_mode?: string;
  verification_status?: VerificationStatus | VerificationStatus[];
  university_id?: string;
  created_by?: string;
  /** Hide admissions whose deadline has passed. */
  exclude_closed?: boolean;
  /** Deadline window (inclusive, ISO-8601). */
  deadline_from?: string;
  deadline_to?: string;
}

/**
 * Admission query parameters
 * Combines filters with pagination and sorting
 */
export interface AdmissionQueryParams extends AdmissionFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  include_closed?: boolean;
}

/**
 * Verify admission request DTO
 */
export interface VerifyAdmissionDTO {
  notes?: string;
}

/**
 * Reject admission request DTO
 */
export interface RejectAdmissionDTO {
  rejection_reason: string;
}
