/**
 * Recommendations Service
 * 
 * Provides personalized admission recommendations for students
 * based on their preferences, profile, and activity.
 * 
 * Responsibilities:
 * - Calculate match scores for admissions
 * - Filter and rank recommendations
 * - Return top N recommendations
 */

import { query } from '@db/connection';
import { AppError } from '@shared/middleware/errorHandler';

/**
 * Recommendation result
 */
export interface Recommendation {
  admission_id: string;
  score: number; // 0-100 match score
  reason: string; // Why this was recommended
  factors: {
    degree_match: number;
    deadline_proximity: number;
    location_preference: number;
    gpa_match: number;
    interest_match: number;
  };
}

/**
 * Get personalized recommendations for a student
 * 
 * Calculates match scores based on:
 * - Degree level match (0-25 points)
 * - Deadline proximity (0-20 points)
 * - Location preference (0-20 points)
 * - GPA/requirements match (0-20 points)
 * - Interest match (0-15 points)
 * 
 * @param userId - Student user ID
 * @param limit - Number of recommendations (default: 10)
 * @param minScore - Minimum match score (default: 75)
 * @returns Array of recommendations sorted by score
 */
export const getRecommendations = async (
  userId: string,
  limit: number = 10,
  minScore: number = 75
): Promise<Recommendation[]> => {
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  try {
    const recommendationsQuery = `
      WITH student_profile AS (
        SELECT 
          u.id,
          u.role as user_type,
          COALESCE(
            jsonb_build_object(
              'preferred_degree_level', NULL,
              'preferred_locations', NULL,
              'gpa', NULL
            ),
            '{}'::jsonb
          ) as preferences
        FROM users u
        LEFT JOIN user_preferences up ON up.user_id = u.id
        WHERE u.id = $1
      ),
      recommendations AS (
        SELECT 
          a.id as admission_id,
          -- Calculate match score
          (
            -- Degree match (0-25)
            CASE 
              WHEN a.degree_level = COALESCE(sp.preferences->>'preferred_degree_level', 'bachelor') THEN 25
              WHEN a.degree_level IN ('bachelor', 'master', 'phd') AND 
                   COALESCE(sp.preferences->>'preferred_degree_level', 'bachelor') IN ('bachelor', 'master', 'phd') THEN 20
              ELSE 15
            END +
            -- Deadline proximity (0-20)
            CASE 
              WHEN a.deadline BETWEEN NOW() AND NOW() + INTERVAL '30 days' THEN 20
              WHEN a.deadline BETWEEN NOW() + INTERVAL '30 days' AND NOW() + INTERVAL '60 days' THEN 15
              WHEN a.deadline BETWEEN NOW() + INTERVAL '60 days' AND NOW() + INTERVAL '90 days' THEN 10
              ELSE 5
            END +
            -- Location preference (0-20)
            CASE 
              WHEN sp.preferences->>'preferred_locations' IS NOT NULL 
                AND a.location = ANY(string_to_array(sp.preferences->>'preferred_locations', ',')) THEN 20
              WHEN sp.preferences->>'preferred_locations' IS NOT NULL 
                AND a.location ILIKE ANY(SELECT '%' || unnest(string_to_array(sp.preferences->>'preferred_locations', ',')) || '%') THEN 15
              ELSE 10
            END +
            -- GPA match (0-20) - if requirements exist
            CASE 
              WHEN a.requirements->>'min_gpa' IS NOT NULL 
                AND (sp.preferences->>'gpa')::float >= (a.requirements->>'min_gpa')::float 
              THEN 20
              WHEN a.requirements->>'min_gpa' IS NULL THEN 15
              ELSE 5
            END +
            -- Interest match (0-15) - based on search history or watchlist
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM watchlists w 
                WHERE w.user_id = $1 
                  AND w.admission_id = a.id
              ) THEN 15
              WHEN EXISTS (
                SELECT 1 FROM user_activity ua
                WHERE ua.user_id = $1
                  AND ua.entity_type = 'admission'
                  AND ua.entity_id = a.id
              ) THEN 12
              ELSE 5
            END
          ) as score,
          CASE 
            WHEN a.degree_level = COALESCE(sp.preferences->>'preferred_degree_level', 'bachelor') 
              AND a.deadline BETWEEN NOW() AND NOW() + INTERVAL '30 days'
            THEN 'High match: Preferred degree level and approaching deadline'
            WHEN a.degree_level = COALESCE(sp.preferences->>'preferred_degree_level', 'bachelor')
            THEN 'Matches your preferred degree level'
            WHEN a.deadline BETWEEN NOW() AND NOW() + INTERVAL '30 days'
            THEN 'Approaching deadline - apply soon'
            ELSE 'Recommended based on your preferences'
          END as reason,
          json_build_object(
            'degree_match', CASE 
              WHEN a.degree_level = COALESCE(sp.preferences->>'preferred_degree_level', 'bachelor') THEN 25
              ELSE 15
            END,
            'deadline_proximity', CASE 
              WHEN a.deadline BETWEEN NOW() AND NOW() + INTERVAL '30 days' THEN 20
              WHEN a.deadline BETWEEN NOW() + INTERVAL '30 days' AND NOW() + INTERVAL '60 days' THEN 15
              ELSE 10
            END,
            'location_preference', CASE 
              WHEN sp.preferences->>'preferred_locations' IS NOT NULL 
                AND a.location = ANY(string_to_array(sp.preferences->>'preferred_locations', ',')) THEN 20
              ELSE 10
            END,
            'gpa_match', CASE 
              WHEN a.requirements->>'min_gpa' IS NOT NULL 
                AND (sp.preferences->>'gpa')::float >= (a.requirements->>'min_gpa')::float 
              THEN 20
              ELSE 10
            END,
            'interest_match', CASE 
              WHEN EXISTS (SELECT 1 FROM watchlists w WHERE w.user_id = $1 AND w.admission_id = a.id) THEN 15
              ELSE 5
            END
          ) as factors
        FROM admissions a
        CROSS JOIN student_profile sp
        WHERE a.verification_status = 'verified'
          AND a.deadline > NOW()
          AND a.is_active = true
      )
      SELECT 
        admission_id,
        score,
        reason,
        factors
      FROM recommendations
      WHERE score >= $2
      ORDER BY score DESC
      LIMIT $3;
    `;

    const result = await query(recommendationsQuery, [userId, minScore, limit]);
    
    return result.rows.map(row => ({
      admission_id: row.admission_id,
      score: parseInt(row.score, 10),
      reason: row.reason,
      factors: row.factors,
    }));
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    throw new AppError(
      `Failed to fetch recommendations: ${error.message}`,
      500
    );
  }
};
