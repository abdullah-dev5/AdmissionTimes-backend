/**
 * Dashboard Domain - Type Definitions
 * 
 * TypeScript interfaces and types for dashboard endpoints.
 * Includes types for student, university, and admin dashboards.
 */

/**
 * User context interface
 * Attached to requests by auth middleware
 */
export interface UserContext {
  id: string | null;
  role: 'student' | 'university' | 'admin' | 'guest';
  university_id?: string | null;
}

/**
 * Student Dashboard Stats
 */
export interface StudentDashboardStats {
  active_admissions: number;
  saved_count: number;
  upcoming_deadlines: number;
  recommendations_count: number;
  unread_notifications: number;
  urgent_deadlines: number;
}

/**
 * Recommended Program for Student Dashboard
 */
export interface RecommendedProgram {
  id: string;
  university_id: string;
  university_name: string;
  title: string;
  degree_level: string;
  deadline: string;
  days_remaining: number;
  application_fee: number;
  location: string;
  verification_status: 'verified' | 'pending' | 'rejected';
  match_score?: number;
  match_reason?: string;
  saved: boolean;
  alert_enabled: boolean;
}

/**
 * Upcoming Deadline for Student Dashboard
 */
export interface UpcomingDeadline {
  id: string;
  admission_id: string;
  university_name: string;
  program_title: string;
  deadline: string;
  days_remaining: number;
  urgency_level: 'low' | 'medium' | 'high' | 'urgent';
  saved: boolean;
  alert_enabled: boolean;
}

/**
 * Recent Notification for Dashboard
 */
export interface RecentNotification {
  id: string;
  notification_type: 'admission_submitted' | 'admission_resubmitted' | 'admission_verified' | 'admission_rejected' | 'admission_revision_required' | 'admission_updated_saved' | 'deadline_near' | 'system_broadcast' | 'system_error';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  action_url: string | null;
}

/**
 * Recent Activity for Dashboard
 */
export interface RecentActivity {
  type: 'notification' | 'saved' | 'alert' | 'deadline';
  action: string;
  timestamp: string;
  related_entity_id?: string;
  related_entity_type?: string;
}

/**
 * Student Dashboard Data
 */
export interface StudentDashboardData {
  stats: StudentDashboardStats;
  recommended_programs: RecommendedProgram[];
  upcoming_deadlines: UpcomingDeadline[];
  recent_notifications: RecentNotification[];
  recent_activity: RecentActivity[];
}

/**
 * University Dashboard Stats
 */
export interface UniversityDashboardStats {
  total_admissions: number;
  pending_verification: number;
  verified_admissions: number;
  recent_updates: number;
  unread_notifications: number;
  pending_audits: number;
  reminder_notifications: number;
  saved_admissions: number;
}

export interface UniversityEngagementTrends {
  labels: string[];
  views: number[];
  clicks: number[];
  reminders: number[];
  saves: number[];
}

/**
 * Recent Admission for University Dashboard
 */
export interface RecentAdmission {
  id: string;
  title: string;
  degree_level: string;
  views?: number;
  verification_status: 'verified' | 'pending' | 'rejected' | 'draft';
  deadline: string;
  created_at: string;
  updated_at: string;
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  verification_comments?: string | null;
  admin_notes?: string | null;
}

/**
 * Pending Verification for University Dashboard
 */
export interface PendingVerification {
  id: string;
  admission_id: string;
  program_title: string;
  submitted_at: string;
  verification_status: 'pending';
  admin_notes: string | null;
}

/**
 * Recent Change for University Dashboard
 */
export interface RecentChange {
  id: string;
  admission_id: string;
  program_title: string;
  field: string;
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by: string;
}

/**
 * University Dashboard Data
 */
export interface UniversityDashboardData {
  stats: UniversityDashboardStats;
  recent_admissions: RecentAdmission[];
  pending_verifications: PendingVerification[];
  recent_changes: RecentChange[];
  recent_notifications: RecentNotification[];
  engagement_trends: UniversityEngagementTrends;
}

/**
 * Admin Dashboard Stats
 */
export interface AdminDashboardStats {
  pending_verifications: number;
  total_admissions: number;
  total_universities: number;
  total_students: number;
  recent_actions: number;
  scraper_jobs_running: number;
}

export interface AdminReminderCoverageThreshold {
  threshold_day: 7 | 3 | 1;
  due_targets: number;
  sent_targets: number;
  missing_targets: number;
}

export interface AdminReminderCoverage {
  look_ahead_days: number;
  total_targets_next_7_days: number;
  total_due_now: number;
  total_sent_now: number;
  total_missing_now: number;
  by_threshold: AdminReminderCoverageThreshold[];
  generated_at: string;
}

/**
 * Admin Dashboard Data
 */
export interface AdminDashboardData {
  stats: AdminDashboardStats;
  pending_verifications: PendingVerification[];
  recent_actions: RecentChange[];
  scraper_activity: any[]; // TODO: Define scraper activity type
  reminder_coverage: AdminReminderCoverage;
}
