/**
 * Admissions Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the admissions domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { VerificationStatus } from '@config/constants';

/**
 * Core admission record interface
 * Matches the database schema
 */
export interface Admission {
  id: string;
  university_id: string | null;
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
  verification_status?: 'draft' | 'pending' | 'verified' | 'rejected';
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
  created_by?: string;
  owner_user_ids?: string[];
  owner_university_ids?: string[];
  is_active?: boolean;
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
}

/**
 * Verify admission request DTO
 */
export interface VerifyAdmissionDTO {
  verified_by?: string;
}

/**
 * Reject admission request DTO
 */
export interface RejectAdmissionDTO {
  rejection_reason: string;
  rejected_by?: string;
}

/**
 * Admin verify/reject request DTO (alias endpoint)
 */
export interface AdminVerifyAdmissionDTO {
  verification_status: 'verified' | 'rejected';
  verified_by?: string;
  rejected_by?: string;
  rejection_reason?: string;
  notes?: string;
}

/**
 * Submit admission request DTO (Draft → Pending)
 */
export interface SubmitAdmissionDTO {
  submitted_by?: string;
}

/**
 * Changelog entry interface
 * Used for creating changelog entries
 */
export interface ChangelogEntry {
  admission_id: string;
  actor_type: 'admin' | 'university' | 'system';
  changed_by: string | null;
  action_type: 'created' | 'updated' | 'verified' | 'rejected' | 'status_changed';
  field_name: string | null;
  old_value: any;
  new_value: any;
  diff_summary: string;
  metadata?: Record<string, any>;
}

/**
 * User context interface
 * Attached to requests by auth middleware
 */
export interface UserContext {
  id: string | null;
  role: 'student' | 'university' | 'admin' | 'guest';
  university_id?: string | null;
}
