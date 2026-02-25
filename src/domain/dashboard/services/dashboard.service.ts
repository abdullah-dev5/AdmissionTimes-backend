/**
 * Dashboard Domain - Service Layer
 * 
 * Business logic for dashboard aggregation endpoints.
 * 
 * Responsibilities:
 * - Aggregate data from multiple sources
 * - Calculate statistics
 * - Format dashboard responses
 * - Handle user-specific data filtering
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import { query } from '@db/connection';
import {
  StudentDashboardData,
  UniversityDashboardData,
  AdminDashboardData,
} from '../types/dashboard.types';
import * as recommendationsService from '@domain/recommendations/services/recommendations.service';

/**
 * Get student dashboard data
 * 
 * Aggregates data from multiple tables to provide a comprehensive
 * student dashboard view with stats, recommendations, deadlines, and notifications.
 * 
 * @param userId - Student user ID
 * @returns Student dashboard data
 * @throws AppError if user not found or invalid
 */
export const getStudentDashboard = async (userId: string): Promise<StudentDashboardData> => {
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    // Execute comprehensive aggregation query
    const dashboardQuery = `
      WITH student_stats AS (
        SELECT 
          (SELECT COUNT(DISTINCT a.id) 
           FROM admissions a
           INNER JOIN watchlists w ON w.admission_id = a.id
           WHERE w.user_id = $1
             AND a.verification_status = 'verified' 
             AND a.deadline > NOW()
             AND a.is_active = true) as active_admissions,
          
          (SELECT COUNT(DISTINCT w.id) 
           FROM watchlists w
           WHERE w.user_id = $1) as saved_count,
          
          (SELECT COUNT(DISTINCT d.id)
           FROM deadlines d
           INNER JOIN admissions a ON a.id = d.admission_id
           LEFT JOIN watchlists w ON w.admission_id = a.id AND w.user_id = $1
           WHERE d.deadline_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
             AND d.deadline_date > NOW()
             AND (w.id IS NOT NULL OR a.verification_status = 'verified')) as upcoming_deadlines,
          
          (SELECT COUNT(DISTINCT d.id)
           FROM deadlines d
           INNER JOIN admissions a ON a.id = d.admission_id
           LEFT JOIN watchlists w ON w.admission_id = a.id AND w.user_id = $1
           WHERE d.deadline_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
             AND d.deadline_date > NOW()
             AND (w.id IS NOT NULL OR a.verification_status = 'verified')) as urgent_deadlines,
          
          (SELECT COUNT(DISTINCT n.id)
           FROM notifications n
           WHERE n.recipient_id = $1 
             AND n.role_type = 'student'
             AND n.is_read = false) as unread_notifications,
          
          (SELECT COUNT(DISTINCT r.id)
           FROM recommendations r
           WHERE r.user_id = $1 
             AND r.expires_at > NOW()) as recommendations_count
        FROM (SELECT 1) as dummy
      ),
      recommended_programs AS (
        SELECT 
          a.id,
          COALESCE(a.university_id::text, 'unknown') as university_id,
          COALESCE(a.location, 'Unknown University') as university_name,
          a.title,
          a.degree_level,
          a.deadline::text as deadline,
          EXTRACT(DAY FROM (a.deadline - NOW()))::int as days_remaining,
          COALESCE(a.application_fee, 0) as application_fee,
          a.location,
          a.verification_status,
          COALESCE(r.score, 0) as match_score,
          COALESCE(r.reason, 'Recommended for you') as match_reason,
          CASE WHEN w.id IS NOT NULL THEN true ELSE false END as saved,
          COALESCE(w.alert_opt_in, false) as alert_enabled
        FROM recommendations r
        INNER JOIN admissions a ON r.admission_id = a.id
        LEFT JOIN watchlists w ON w.admission_id = a.id AND w.user_id = $1
        WHERE r.user_id = $1
          AND r.expires_at > NOW()
          AND a.verification_status = 'verified'
          AND a.deadline > NOW()
          AND a.is_active = true
        ORDER BY r.score DESC, a.deadline ASC
        LIMIT 10
      ),
      upcoming_deadlines AS (
        SELECT 
          d.id,
          d.admission_id::text,
          COALESCE(a.location, 'Unknown University') as university_name,
          a.title as program_title,
          d.deadline_date::text as deadline,
          EXTRACT(DAY FROM (d.deadline_date - NOW()))::int as days_remaining,
          CASE 
            WHEN EXTRACT(DAY FROM (d.deadline_date - NOW())) <= 3 THEN 'urgent'
            WHEN EXTRACT(DAY FROM (d.deadline_date - NOW())) <= 7 THEN 'high'
            WHEN EXTRACT(DAY FROM (d.deadline_date - NOW())) <= 14 THEN 'medium'
            ELSE 'low'
          END as urgency_level,
          CASE WHEN w.id IS NOT NULL THEN true ELSE false END as saved,
          COALESCE(w.alert_opt_in, false) as alert_enabled
        FROM deadlines d
        INNER JOIN admissions a ON a.id = d.admission_id
        LEFT JOIN watchlists w ON w.admission_id = a.id AND w.user_id = $1
        WHERE d.deadline_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
          AND d.deadline_date > NOW()
          AND (w.id IS NOT NULL OR a.verification_status = 'verified')
        ORDER BY d.deadline_date ASC
        LIMIT 3
      ),
      recent_notifications AS (
        SELECT 
          id::text,
          notification_type::text,
          priority::text,
          title,
          message,
          is_read,
          created_at::text,
          action_url
        FROM notifications
        WHERE recipient_id = $1 
          AND role_type = 'student'
        ORDER BY created_at DESC
        LIMIT 5
      ),
      recent_activity AS (
        SELECT 
          'notification' as type,
          title as action,
          created_at::text as timestamp,
          id::text as related_entity_id,
          'notification' as related_entity_type
        FROM notifications
        WHERE recipient_id = $1 AND role_type = 'student'
        
        UNION ALL
        
        SELECT 
          'saved' as type,
          'Saved program: ' || a.title as action,
          w.created_at::text as timestamp,
          w.admission_id::text as related_entity_id,
          'admission' as related_entity_type
        FROM watchlists w
        INNER JOIN admissions a ON a.id = w.admission_id
        WHERE w.user_id = $1
        
        ORDER BY timestamp DESC
        LIMIT 3
      )
      SELECT 
        (SELECT row_to_json(ss) FROM student_stats ss) as stats,
        COALESCE((SELECT json_agg(row_to_json(rp)) FROM recommended_programs rp), '[]'::json) as recommended_programs,
        COALESCE((SELECT json_agg(row_to_json(ud)) FROM upcoming_deadlines ud), '[]'::json) as upcoming_deadlines,
        COALESCE((SELECT json_agg(row_to_json(rn)) FROM recent_notifications rn), '[]'::json) as recent_notifications,
        COALESCE((SELECT json_agg(row_to_json(ra)) FROM recent_activity ra), '[]'::json) as recent_activity;
    `;

    const result = await query(dashboardQuery, [userId]);
    const row = result.rows[0];

    // If no recommendations exist, generate them on-demand
    let recommendedPrograms = row.recommended_programs || [];
    if (recommendedPrograms.length === 0) {
      try {
        console.log(`[Dashboard] No recommendations found for user ${userId}, generating...`);
        await recommendationsService.generateRecommendationsForUser(userId);
        
        // Re-fetch recommendations after generation
        const recsQuery = `
          SELECT 
            a.id,
            COALESCE(a.university_id::text, 'unknown') as university_id,
            COALESCE(a.location, 'Unknown University') as university_name,
            a.title,
            a.degree_level,
            a.deadline::text as deadline,
            EXTRACT(DAY FROM (a.deadline - NOW()))::int as days_remaining,
            COALESCE(a.application_fee, 0) as application_fee,
            a.location,
            a.verification_status,
            COALESCE(r.score, 0) as match_score,
            COALESCE(r.reason, 'Recommended for you') as match_reason,
            CASE WHEN w.id IS NOT NULL THEN true ELSE false END as saved,
            COALESCE(w.alert_opt_in, false) as alert_enabled
          FROM recommendations r
          INNER JOIN admissions a ON r.admission_id = a.id
          LEFT JOIN watchlists w ON w.admission_id = a.id AND w.user_id = $1
          WHERE r.user_id = $1
            AND r.expires_at > NOW()
            AND a.verification_status = 'verified'
            AND a.deadline > NOW()
            AND a.is_active = true
          ORDER BY r.score DESC, a.deadline ASC
          LIMIT 10
        `;
        const recsResult = await query(recsQuery, [userId]);
        recommendedPrograms = recsResult.rows;
        console.log(`[Dashboard] Generated ${recommendedPrograms.length} recommendations`);
      } catch (genError) {
        console.warn('[Dashboard] Failed to generate recommendations:', genError);
        // Continue without recommendations rather than failing the entire dashboard
      }
    }

    // Transform the result to match the expected structure
    // Ensure all fields use snake_case and proper types
    const dashboardData: StudentDashboardData = {
      stats: {
        active_admissions: parseInt(row.stats?.active_admissions || 0, 10),
        saved_count: parseInt(row.stats?.saved_count || 0, 10),
        upcoming_deadlines: parseInt(row.stats?.upcoming_deadlines || 0, 10),
        recommendations_count: parseInt(row.stats?.recommendations_count || 0, 10),
        unread_notifications: parseInt(row.stats?.unread_notifications || 0, 10),
        urgent_deadlines: parseInt(row.stats?.urgent_deadlines || 0, 10),
      },
      recommended_programs: (recommendedPrograms || []).map((program: any) => ({
        ...program,
        verification_status: program.verification_status || 'verified',
        match_score: parseInt(program.match_score || 0, 10),
        days_remaining: parseInt(program.days_remaining || 0, 10),
        application_fee: parseFloat(program.application_fee || 0),
        saved: Boolean(program.saved),
        alert_enabled: Boolean(program.alert_enabled),
      })),
      upcoming_deadlines: (row.upcoming_deadlines || []).map((deadline: any) => ({
        ...deadline,
        days_remaining: parseInt(deadline.days_remaining || 0, 10),
        saved: Boolean(deadline.saved),
        alert_enabled: Boolean(deadline.alert_enabled),
      })),
      recent_notifications: (row.recent_notifications || []).map((notif: any) => ({
        ...notif,
        is_read: Boolean(notif.is_read),
      })),
      recent_activity: row.recent_activity || [],
    };

    return dashboardData;
  } catch (error: any) {
    console.error('Error fetching student dashboard:', error);
    throw new AppError(
      `Failed to fetch student dashboard: ${error.message}`,
      500
    );
  }
};

/**
 * Get university dashboard data
 * 
 * Aggregates data for university users showing their admissions,
 * verification status, and recent changes.
 * 
 * @param userId - University user ID
 * @param universityId - University ID (optional, for filtering)
 * @returns University dashboard data
 * @throws AppError if user not found or invalid
 */
export const getUniversityDashboard = async (
  userId: string,
  universityId?: string | null
): Promise<UniversityDashboardData> => {
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    // Get full linked identity set (same logic as admissions.service.ts)
    const linkedIdentitiesSql = `
      WITH base_user AS (
        SELECT id, auth_user_id, email, university_id
        FROM users
        WHERE id = $1::uuid
      ),
      linked_users AS (
        SELECT u.id, u.auth_user_id, u.university_id
        FROM users u, base_user b
        WHERE u.role = 'university'
          AND (
            u.id = b.id
            OR u.auth_user_id = b.auth_user_id
            OR (b.email IS NOT NULL AND u.email = b.email)
            OR (b.university_id IS NOT NULL AND u.university_id = b.university_id)
          )
      )
      SELECT
        COALESCE(array_agg(DISTINCT id::text) FILTER (WHERE id IS NOT NULL), ARRAY[]::text[]) as user_ids,
        COALESCE(array_agg(DISTINCT auth_user_id::text) FILTER (WHERE auth_user_id IS NOT NULL), ARRAY[]::text[]) as auth_user_ids,
        COALESCE(array_agg(DISTINCT university_id::text) FILTER (WHERE university_id IS NOT NULL), ARRAY[]::text[]) as university_ids
      FROM linked_users;
    `;

    const identitiesResult = await query(linkedIdentitiesSql, [userId]);
    const identities = identitiesResult.rows[0] || { user_ids: [], auth_user_ids: [], university_ids: [] };

    // Ensure arrays are never null or empty
    const allUserIds = Array.isArray(identities.user_ids) && identities.user_ids.length > 0 
      ? identities.user_ids 
      : [userId];
    const allAuthUserIds = Array.isArray(identities.auth_user_ids) && identities.auth_user_ids.length > 0
      ? identities.auth_user_ids
      : [];
    const allUniversityIds = Array.isArray(identities.university_ids) && identities.university_ids.length > 0
      ? identities.university_ids
      : universityId ? [universityId] : [];

    // Combine user IDs and auth user IDs for created_by matching
    // (users might have same auth_user_id with different user table IDs)
    const combinedUserIds = [...new Set([...allUserIds, ...allAuthUserIds])];
    // University IDs should ONLY contain organization IDs, NOT auth_user_ids
    const combinedUniversityIds = allUniversityIds;

    console.log('🔵 [dashboardService] Linked identities resolved:', {
      userId,
      universityId,
      combinedUserIds,
      combinedUniversityIds,
    });

    const dashboardQuery = `
      WITH university_stats AS (
        SELECT 
          COUNT(DISTINCT a.id) as total_admissions,
          COUNT(DISTINCT CASE 
            WHEN a.verification_status = 'pending' 
            THEN a.id 
          END) as pending_verification,
          COUNT(DISTINCT CASE 
            WHEN a.verification_status = 'verified' 
            THEN a.id 
          END) as verified_admissions,
          COUNT(DISTINCT CASE 
            WHEN a.updated_at >= NOW() - INTERVAL '7 days'
            THEN a.id 
          END) as recent_updates,
          COUNT(DISTINCT CASE 
            WHEN n.is_read = false 
            THEN n.id 
          END) as unread_notifications,
          COUNT(DISTINCT CASE 
            WHEN a.verification_status = 'pending'
            THEN a.id 
          END) as pending_audits
        FROM admissions a
        LEFT JOIN notifications n ON n.recipient_id = $1 AND n.role_type = 'university'
        WHERE (a.created_by::text = ANY($2::text[]) OR a.university_id::text = ANY($3::text[]))
          AND a.is_active = true
      ),
      recent_admissions AS (
        SELECT 
          id::text,
          title,
          description,
          program_type,
          degree_level,
          field_of_study,
          duration,
          tuition_fee,
          currency,
          application_fee,
          deadline::text,
          start_date,
          location,
          delivery_mode,
          requirements,
          verification_status::text,
          verified_by::text,
          verified_at::text,
          rejection_reason,
          dispute_reason,
          verification_comments,
          admin_notes,
          created_at::text,
          updated_at::text
        FROM admissions
        WHERE (created_by::text = ANY($2::text[]) OR university_id::text = ANY($3::text[]))
          AND is_active = true
        ORDER BY updated_at DESC
      ),
      pending_verifications AS (
        SELECT 
          a.id::text,
          a.id::text as admission_id,
          a.title as program_title,
          a.updated_at::text as submitted_at,
          'pending' as verification_status,
          NULL as admin_notes
        FROM admissions a
        WHERE (a.created_by::text = ANY($2::text[]) OR a.university_id::text = ANY($3::text[]))
          AND a.verification_status = 'pending'
          AND a.is_active = true
        ORDER BY a.updated_at DESC
        LIMIT 20
      ),
      recent_changes AS (
        SELECT 
          cl.id::text,
          cl.admission_id::text,
          a.title as program_title,
          COALESCE(cl.field_name, 'status') as field,
          COALESCE(cl.old_value::text, '') as old_value,
          COALESCE(cl.new_value::text, '') as new_value,
          cl.created_at::text as changed_at,
          COALESCE(cl.changed_by::text, 'system') as changed_by
        FROM changelogs cl
        INNER JOIN admissions a ON a.id = cl.admission_id
        WHERE a.created_by::text = ANY($2::text[]) OR a.university_id::text = ANY($3::text[])
        ORDER BY cl.created_at DESC
        LIMIT 10
      ),
      recent_notifications AS (
        SELECT 
          id::text,
          notification_type::text,
          priority::text,
          title,
          message,
          is_read,
          created_at::text,
          action_url
        FROM notifications
        WHERE recipient_id = $1 
          AND role_type = 'university'
        ORDER BY created_at DESC
        LIMIT 10
      )
      SELECT 
        (SELECT row_to_json(us) FROM university_stats us) as stats,
        COALESCE((SELECT json_agg(row_to_json(ra)) FROM recent_admissions ra), '[]'::json) as recent_admissions,
        COALESCE((SELECT json_agg(row_to_json(pv)) FROM pending_verifications pv), '[]'::json) as pending_verifications,
        COALESCE((SELECT json_agg(row_to_json(rc)) FROM recent_changes rc), '[]'::json) as recent_changes,
        COALESCE((SELECT json_agg(row_to_json(rn)) FROM recent_notifications rn), '[]'::json) as recent_notifications;
    `;

    const result = await query(dashboardQuery, [userId, combinedUserIds, combinedUniversityIds]);
    const row = result.rows[0];

    // Transform the result to match the expected structure
    // Ensure all fields use snake_case and proper types
    const dashboardData: UniversityDashboardData = {
      stats: {
        total_admissions: parseInt(row.stats?.total_admissions || 0, 10),
        pending_verification: parseInt(row.stats?.pending_verification || 0, 10),
        verified_admissions: parseInt(row.stats?.verified_admissions || 0, 10),
        recent_updates: parseInt(row.stats?.recent_updates || 0, 10),
        unread_notifications: parseInt(row.stats?.unread_notifications || 0, 10),
        pending_audits: parseInt(row.stats?.pending_audits || 0, 10),
      },
      recent_admissions: (row.recent_admissions || []).map((admission: any) => ({
        ...admission,
        verification_status: admission.verification_status || 'pending',
      })),
      pending_verifications: row.pending_verifications || [],
      recent_changes: row.recent_changes || [],
      recent_notifications: (row.recent_notifications || []).map((notif: any) => ({
        ...notif,
        is_read: Boolean(notif.is_read),
      })),
    };

    return dashboardData;
  } catch (error: any) {
    console.error('Error fetching university dashboard:', error);
    throw new AppError(
      `Failed to fetch university dashboard: ${error.message}`,
      500
    );
  }
};

/**
 * Get admin dashboard data
 * 
 * Aggregates system-wide data for admin users.
 * 
 * @param userId - Admin user ID
 * @returns Admin dashboard data
 * @throws AppError if user not found or invalid
 */
export const getAdminDashboard = async (userId: string): Promise<AdminDashboardData> => {
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    const dashboardQuery = `
      WITH admin_stats AS (
        SELECT 
          (SELECT COUNT(DISTINCT a.id)
           FROM admissions a
           WHERE a.verification_status = 'pending') as pending_verifications,
          (SELECT COUNT(DISTINCT a.id)
           FROM admissions a) as total_admissions,
          (SELECT COUNT(DISTINCT u.id)
           FROM users u
           WHERE u.role = 'university') as total_universities,
          (SELECT COUNT(DISTINCT u.id)
           FROM users u
           WHERE u.role = 'student') as total_students,
          (SELECT COUNT(DISTINCT cl.id)
           FROM changelogs cl
           WHERE cl.created_at >= NOW() - INTERVAL '7 days') as recent_actions,
          0::integer as scraper_jobs_running
        FROM (SELECT 1) as dummy
      ),
      pending_verifications AS (
        SELECT 
          a.id::text,
          a.id::text as admission_id,
          a.title as program_title,
          COALESCE(
            univ.name,
            user_univ.name, 
            a.location, 
            'Unknown University'
          ) as university_name,
          a.updated_at::text as submitted_at,
          'pending' as verification_status,
          NULL as admin_notes
        FROM admissions a
        LEFT JOIN universities univ ON univ.id = a.university_id
        LEFT JOIN users u ON u.id = a.created_by
        LEFT JOIN universities user_univ ON user_univ.id = u.university_id
        WHERE a.verification_status = 'pending'
        ORDER BY a.updated_at DESC
        LIMIT 10
      ),
      recent_actions AS (
        SELECT 
          cl.id::text,
          cl.admission_id::text,
          a.title as program_title,
          COALESCE(cl.field_name, 'status') as field,
          COALESCE(cl.old_value::text, '') as old_value,
          COALESCE(cl.new_value::text, '') as new_value,
          cl.created_at::text as changed_at,
          COALESCE(cl.changed_by::text, 'system') as changed_by
        FROM changelogs cl
        INNER JOIN admissions a ON a.id = cl.admission_id
        ORDER BY cl.created_at DESC
        LIMIT 10
      )
      SELECT 
        (SELECT row_to_json(ast) FROM admin_stats ast) as stats,
        COALESCE((SELECT json_agg(row_to_json(pv)) FROM pending_verifications pv), '[]'::json) as pending_verifications,
        COALESCE((SELECT json_agg(row_to_json(ra)) FROM recent_actions ra), '[]'::json) as recent_actions;
    `;

    console.log('🔍 [getAdminDashboard] Executing dashboard query...');
    const result = await query(dashboardQuery, []);
    const row = result.rows[0];

    console.log('🔍 [getAdminDashboard] Raw pending_verifications:', JSON.stringify(row.pending_verifications, null, 2));

    // Transform the result to match the expected structure
    // Ensure all fields use snake_case and proper types
    const dashboardData: AdminDashboardData = {
      stats: {
        pending_verifications: parseInt(row.stats?.pending_verifications || 0, 10),
        total_admissions: parseInt(row.stats?.total_admissions || 0, 10),
        total_universities: parseInt(row.stats?.total_universities || 0, 10),
        total_students: parseInt(row.stats?.total_students || 0, 10),
        recent_actions: parseInt(row.stats?.recent_actions || 0, 10),
        scraper_jobs_running: parseInt(row.stats?.scraper_jobs_running || 0, 10),
      },
      pending_verifications: row.pending_verifications || [],
      recent_actions: row.recent_actions || [],
      scraper_activity: [], // TODO: Implement scraper activity
    };

    return dashboardData;
  } catch (error: any) {
    console.error('Error fetching admin dashboard:', error);
    throw new AppError(
      `Failed to fetch admin dashboard: ${error.message}`,
      500
    );
  }
};
