/**
 * Recommendations Domain - Model Layer
 * 
 * Database access layer for recommendations.
 * Contains all raw SQL queries with parameterized statements.
 */

import { query } from '@db/connection';
import { Recommendation, CreateRecommendationDTO, RecommendationWithAdmission } from '../types/recommendations.types';

/**
 * Find recommendations for a user
 * 
 * @param userId - User UUID
 * @param limit - Maximum number of recommendations to return
 * @param minScore - Minimum score threshold (0-100)
 * @returns Array of recommendations with admission details
 */
export const findByUserId = async (
  userId: string,
  limit: number = 10,
  minScore: number = 0
): Promise<RecommendationWithAdmission[]> => {
  const sql = `
    SELECT 
      r.*,
      json_build_object(
        'id', a.id,
        'university_id', a.university_id,
        'program_name', a.program_name,
        'degree_level', a.degree_level,
        'status', a.verification_status,
        'verification_status', a.verification_status,
        'deadline', a.deadline
      ) as admission
    FROM recommendations r
    INNER JOIN admissions a ON r.admission_id = a.id
    WHERE r.user_id = $1
      AND r.score >= $2
      AND r.expires_at > NOW()
      AND a.verification_status = 'verified'
      AND a.deadline > NOW()
      AND a.is_active = true
    ORDER BY r.score DESC
    LIMIT $3
  `;
  const result = await query(sql, [userId, minScore, limit]);
  return result.rows;
};

/**
 * Insert a single recommendation
 * 
 * @param data - Recommendation data
 * @returns Created recommendation
 */
export const create = async (data: CreateRecommendationDTO): Promise<Recommendation> => {
  const expiresAt = data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days default

  const sql = `
    INSERT INTO recommendations (user_id, admission_id, score, reason, factors, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, admission_id) 
    DO UPDATE SET
      score = EXCLUDED.score,
      reason = EXCLUDED.reason,
      factors = EXCLUDED.factors,
      generated_at = NOW(),
      expires_at = EXCLUDED.expires_at
    RETURNING *
  `;

  const result = await query(sql, [
    data.user_id,
    data.admission_id,
    data.score,
    data.reason,
    JSON.stringify(data.factors),
    expiresAt
  ]);

  return result.rows[0];
};

/**
 * Bulk insert recommendations (efficient batch insert)
 * 
 * @param recommendations - Array of recommendation data
 * @returns Number of recommendations created
 */
export const bulkCreate = async (recommendations: CreateRecommendationDTO[]): Promise<number> => {
  if (recommendations.length === 0) return 0;

  const values: any[] = [];
  const placeholders: string[] = [];
  let paramIndex = 1;

  recommendations.forEach((rec) => {
    const expiresAt = rec.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    placeholders.push(
      `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
    );
    values.push(
      rec.user_id,
      rec.admission_id,
      rec.score,
      rec.reason,
      JSON.stringify(rec.factors),
      expiresAt
    );
    paramIndex += 6;
  });

  const sql = `
    INSERT INTO recommendations (user_id, admission_id, score, reason, factors, expires_at)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (user_id, admission_id) 
    DO UPDATE SET
      score = EXCLUDED.score,
      reason = EXCLUDED.reason,
      factors = EXCLUDED.factors,
      generated_at = NOW(),
      expires_at = EXCLUDED.expires_at
  `;

  const result = await query(sql, values);
  return result.rowCount || 0;
};

/**
 * Delete expired recommendations
 * 
 * @returns Number of deleted recommendations
 */
export const deleteExpired = async (): Promise<number> => {
  const sql = 'DELETE FROM recommendations WHERE expires_at <= NOW()';
  const result = await query(sql);
  return result.rowCount || 0;
};

/**
 * Delete all recommendations for a user
 * 
 * @param userId - User UUID
 * @returns Number of deleted recommendations
 */
export const deleteByUserId = async (userId: string): Promise<number> => {
  const sql = 'DELETE FROM recommendations WHERE user_id = $1';
  const result = await query(sql, [userId]);
  return result.rowCount || 0;
};

/**
 * Count recommendations for a user
 * 
 * @param userId - User UUID
 * @returns Total count of active recommendations
 */
export const countByUserId = async (userId: string): Promise<number> => {
  const sql = `
    SELECT COUNT(*) as count
    FROM recommendations
    WHERE user_id = $1 AND expires_at > NOW()
  `;
  const result = await query(sql, [userId]);
  return parseInt(result.rows[0].count, 10);
};
