/**
 * Admin Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the admin domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { VerificationStatus } from '@config/constants';

/**
 * User context from JWT token
 */
export interface UserContext {
  id: string;
  email?: string;
  role: 'admin' | 'student' | 'university' | 'guest';
  university_id?: string | null;
}

/**
 * Admin verification action types
 */
export type AdminActionType =
  | 'verify'
  | 'reject'
  | 'update_notes'
  | 'bulk_verify';

/**
 * Admin Audit Log interface
 */
export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action_type: AdminActionType;
  entity_type: 'admission' | 'user' | 'university' | 'settings';
  entity_id: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string; // ISO8601 timestamp
  created_by: string;
}

/**
 * Admission with admin details
 */
export interface AdminAdmission {
  id: string;
  university_id: string | null;
  created_by?: string | null;
  title: string;
  description: string | null;
  program_type: string | null;
  degree_level: string | null;
  field_of_study: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  admin_notes: string | null;
  verification_comments: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

/**
 * DTO for verifying admission
 */
export interface AdminVerifyAdmissionDTO {
  verification_status: 'verified' | 'rejected';
  rejection_reason?: string; // Required if status = 'rejected'
  admin_notes?: string;
  verification_comments?: string;
}

/**
 * DTO for requesting revision on an admission
 */
export interface AdminRevisionRequestDTO {
  reason: string;
}

/**
 * DTO for bulk verification
 */
export interface AdminBulkVerifyDTO {
  admission_ids: string[];
  verification_status: 'verified' | 'rejected';
  rejection_reason?: string;
  admin_notes?: string;
}

/**
 * Admin Dashboard Statistics
 */
export interface AdminDashboardStats {
  total_admissions: number;
  pending_count: number;
  verified_count: number;
  rejected_count: number;
  universities_active: number;
  students_registered: number;
  verification_rate: number; // percentage
}

/**
 * Admin Dashboard Response
 */
export interface AdminDashboard {
  stats: AdminDashboardStats;
  pending_verifications: AdminAdmission[];
  recent_actions: AdminAuditLog[];
}

/**
 * Query params for filtering
 */
export interface AdminFilterParams {
  page?: number;
  limit?: number;
  status?: VerificationStatus;
  university_id?: string;
  verified_by?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * DTO for creating university representative via admin panel (Flow C)
 */
export interface AdminCreateUniversityRepDTO {
  email: string;
  display_name: string;
  university_name: string;
  city?: string | null;
  country?: string | null;
  website?: string | null;
}

/**
 * Response payload for create university representative
 */
export interface AdminCreateUniversityRepResponse {
  user: {
    id: string;
    email: string;
    role: 'university';
    university_id: string;
    display_name: string;
  };
  university: {
    id: string;
    name: string;
  };
  credentials: {
    temporary_password: string;
    show_once: true;
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
