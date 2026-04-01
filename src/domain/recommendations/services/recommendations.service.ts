/**
 * Recommendations Domain - Service Layer
 * 
 * Business logic for generating personalized recommendations.
 * 
 * Algorithm: Collaborative Filtering
 * - Finds students with similar interests (based on watchlists)
 * - Recommends programs those similar students have watched
 * - Scores based on overlap and popularity
 * 
 * Simple, efficient, and smart!
 */

import { query } from '@db/connection';
import * as recommendationsModel from '../models/recommendations.model';
import { CreateRecommendationDTO, RecommendationWithAdmission } from '../types/recommendations.types';

const RECOMMENDATION_REFRESH_COOLDOWN_MINUTES = 30;
const RECOMMENDATION_MAX_STALE_HOURS = 24;
const ACTIVITY_LOOKBACK_DAYS = 7;

type RefreshSignalReason = 'no_cache' | 'stale_cache' | 'activity_invalidated' | 'fresh_cache';

const recommendationMetrics = {
  started_at: new Date().toISOString(),
  requests_total: 0,
  served_from_cache_total: 0,
  empty_response_total: 0,
  sync_regeneration_triggered_total: 0,
  sync_regeneration_created_total: 0,
  async_refresh_triggered_total: 0,
  async_refresh_skipped_total: 0,
  async_refresh_failed_total: 0,
  manual_refresh_total: 0,
  batch_generation_runs_total: 0,
  generation_runs_total: 0,
  generation_created_total: 0,
  refresh_reason_counts: {
    no_cache: 0,
    stale_cache: 0,
    activity_invalidated: 0,
    fresh_cache: 0,
  } as Record<RefreshSignalReason, number>,
  generation_mode_counts: {
    collaborative: 0,
    fallback: 0,
    popular: 0,
  },
};

const incrementRefreshReason = (reason: RefreshSignalReason): void => {
  recommendationMetrics.refresh_reason_counts[reason] += 1;
};

export const getRecommendationObservability = () => {
  const requests = recommendationMetrics.requests_total;
  const emptyRate = requests > 0
    ? Number(((recommendationMetrics.empty_response_total / requests) * 100).toFixed(2))
    : 0;
  const cacheHitRate = requests > 0
    ? Number(((recommendationMetrics.served_from_cache_total / requests) * 100).toFixed(2))
    : 0;

  return {
    ...recommendationMetrics,
    empty_response_rate_percent: emptyRate,
    cache_hit_rate_percent: cacheHitRate,
    policy: {
      refresh_cooldown_minutes: RECOMMENDATION_REFRESH_COOLDOWN_MINUTES,
      max_stale_hours: RECOMMENDATION_MAX_STALE_HOURS,
      activity_lookback_days: ACTIVITY_LOOKBACK_DAYS,
    },
  };
};

const shouldRefreshFromRecentActivity = async (
  userId: string
): Promise<{ shouldRefresh: boolean; reason: RefreshSignalReason }> => {
  const sql = `
    WITH rec AS (
      SELECT MAX(generated_at) as last_generated_at
      FROM recommendations
      WHERE user_id = $1 AND expires_at > NOW()
    ),
    activity AS (
      SELECT MAX(created_at) as last_activity_at
      FROM user_activity
      WHERE user_id = $1
        AND activity_type IN ('saved', 'watchlisted', 'searched', 'compared', 'viewed')
        AND created_at >= NOW() - INTERVAL '${ACTIVITY_LOOKBACK_DAYS} days'
    )
    SELECT
      rec.last_generated_at,
      activity.last_activity_at,
      CASE
        WHEN rec.last_generated_at IS NULL THEN 'no_cache'
        WHEN rec.last_generated_at < NOW() - INTERVAL '${RECOMMENDATION_MAX_STALE_HOURS} hours' THEN 'stale_cache'
        WHEN activity.last_activity_at IS NOT NULL
          AND activity.last_activity_at > rec.last_generated_at
          AND rec.last_generated_at < NOW() - INTERVAL '${RECOMMENDATION_REFRESH_COOLDOWN_MINUTES} minutes'
        THEN 'activity_invalidated'
        ELSE 'fresh_cache'
      END as refresh_reason,
      (
        rec.last_generated_at IS NULL
        OR rec.last_generated_at < NOW() - INTERVAL '${RECOMMENDATION_MAX_STALE_HOURS} hours'
        OR (
          activity.last_activity_at IS NOT NULL
          AND activity.last_activity_at > rec.last_generated_at
          AND rec.last_generated_at < NOW() - INTERVAL '${RECOMMENDATION_REFRESH_COOLDOWN_MINUTES} minutes'
        )
      ) as should_refresh
    FROM rec, activity
  `;

  const result = await query(sql, [userId]);
  const row = result.rows[0] || {};
  const reason = (row.refresh_reason || 'fresh_cache') as RefreshSignalReason;
  return {
    shouldRefresh: Boolean(row.should_refresh),
    reason,
  };
};

/**
 * Get recommendations for a user
 * 
 * @param userId - User UUID
 * @param limit - Maximum number of recommendations
 * @param minScore - Minimum score threshold (0-100)
 * @returns Array of recommendations with admission details
 */
export const getRecommendations = async (
  userId: string,
  limit: number = 10,
  minScore: number = 50
): Promise<RecommendationWithAdmission[]> => {
  recommendationMetrics.requests_total += 1;

  // Check if user has fresh recommendations
  const recommendations = await recommendationsModel.findByUserId(userId, limit, minScore);
  
  // If no recommendations exist, generate them on-demand
  if (recommendations.length === 0) {
    recommendationMetrics.sync_regeneration_triggered_total += 1;
    const created = await generateRecommendationsForUser(userId);
    recommendationMetrics.sync_regeneration_created_total += created;

    const regenerated = await recommendationsModel.findByUserId(userId, limit, minScore);
    if (regenerated.length === 0) {
      recommendationMetrics.empty_response_total += 1;
    }
    incrementRefreshReason('no_cache');
    return regenerated;
  }

  recommendationMetrics.served_from_cache_total += 1;

  // Keep response fast: refresh asynchronously only when stale or invalidated by recent activity.
  try {
    const refreshSignal = await shouldRefreshFromRecentActivity(userId);
    incrementRefreshReason(refreshSignal.reason);
    if (refreshSignal.shouldRefresh) {
      recommendationMetrics.async_refresh_triggered_total += 1;
      void generateRecommendationsForUser(userId).catch((error) => {
        recommendationMetrics.async_refresh_failed_total += 1;
        console.warn(`[Recommendations] Async refresh skipped for user ${userId}:`, error);
      });
    } else {
      recommendationMetrics.async_refresh_skipped_total += 1;
    }
  } catch (error) {
    recommendationMetrics.async_refresh_failed_total += 1;
    console.warn(`[Recommendations] Failed to evaluate refresh signal for user ${userId}:`, error);
  }

  return recommendations;
};

/**
 * Generate recommendations for a specific user
 * Uses collaborative filtering based on watchlists
 * 
 * Algorithm:
 * 1. Find programs the user has watched
 * 2. Find other students who also watched those programs (similar users)
 * 3. Find programs those similar students watched that the current user hasn't
 * 4. Score based on:
 *    - Number of similar users who watched it (popularity)
 *    - Overlap percentage (similarity strength)
 * 
 * @param userId - User UUID
 * @returns Number of recommendations created
 */
export const generateRecommendationsForUser = async (userId: string): Promise<number> => {
  recommendationMetrics.generation_runs_total += 1;

  // First check if user has any watchlist items
  const watchlistCheck = await query(
    'SELECT COUNT(*) as count FROM watchlists WHERE user_id = $1',
    [userId]
  );
  const watchlistCount = parseInt(watchlistCheck.rows[0].count, 10);

  // If no watchlist, show popular programs
  if (watchlistCount === 0) {
    console.log(`[Recommendations] User ${userId} has no watchlist, showing popular programs...`);
    const created = await generatePopularRecommendations(userId);
    recommendationMetrics.generation_mode_counts.popular += 1;
    recommendationMetrics.generation_created_total += created;
    return created;
  }

  const sql = `
    WITH user_watchlist AS (
      -- Step 1: Get programs the target user has watched
      SELECT admission_id
      FROM watchlists
      WHERE user_id = $1
    ),
    similar_users AS (
      -- Step 2: Find users who watched the same programs
      SELECT 
        w.user_id,
        COUNT(DISTINCT w.admission_id) as overlap_count,
        COUNT(DISTINCT uw.admission_id) as user_total
      FROM watchlists w
      INNER JOIN user_watchlist uw ON w.admission_id = uw.admission_id
      WHERE w.user_id != $1  -- Exclude the target user
      GROUP BY w.user_id
      HAVING COUNT(DISTINCT w.admission_id) >= 1  -- At least 1 overlap
    ),
    candidate_programs AS (
      -- Step 3: Find programs similar users watched that target user hasn't
      SELECT 
        w.admission_id,
        COUNT(DISTINCT su.user_id) as similar_user_count,
        AVG(su.overlap_count::float / su.user_total) as avg_similarity
      FROM watchlists w
      INNER JOIN similar_users su ON w.user_id = su.user_id
      WHERE w.admission_id NOT IN (SELECT admission_id FROM user_watchlist)
      GROUP BY w.admission_id
    ),
    scored_recommendations AS (
      -- Step 4: Score and rank recommendations
      SELECT 
        $1 as user_id,
        cp.admission_id,
        LEAST(
          ROUND(
            (cp.similar_user_count * 20 + cp.avg_similarity * 80)::numeric, 
            0
          )::integer,
          100
        ) as score,
        CASE 
          WHEN cp.similar_user_count >= 5 THEN 
            'Highly popular among students with similar interests (' || cp.similar_user_count || ' students)'
          WHEN cp.similar_user_count >= 3 THEN 
            'Popular among similar students (' || cp.similar_user_count || ' students)'
          ELSE 
            'Recommended based on your interests'
        END as reason,
        json_build_object(
          'similar_users_count', cp.similar_user_count,
          'avg_similarity', ROUND(cp.avg_similarity::numeric, 2),
          'algorithm', 'collaborative_filtering'
        ) as factors
      FROM candidate_programs cp
      INNER JOIN admissions a ON cp.admission_id = a.id
      WHERE a.verification_status = 'verified'
        AND a.deadline > NOW()
        AND a.is_active = true
      ORDER BY score DESC
      LIMIT 20  -- Generate top 20 recommendations
    )
    SELECT * FROM scored_recommendations WHERE score >= 30;  -- Minimum quality threshold
  `;

  const result = await query(sql, [userId]);
  
  // If no collaborative recommendations, use content-based fallback
  if (result.rows.length === 0) {
    console.log(`[Recommendations] No collaborative recommendations for user ${userId}, using fallback...`);
    const created = await generateFallbackRecommendations(userId);
    recommendationMetrics.generation_mode_counts.fallback += 1;
    recommendationMetrics.generation_created_total += created;
    return created;
  }

  // Prepare recommendations for bulk insert
  const recommendations: CreateRecommendationDTO[] = result.rows.map((row: any) => ({
    user_id: row.user_id,
    admission_id: row.admission_id,
    score: row.score,
    reason: row.reason,
    factors: row.factors,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days TTL
  }));

  // Bulk insert recommendations
  const created = await recommendationsModel.bulkCreate(recommendations);
  recommendationMetrics.generation_mode_counts.collaborative += 1;
  recommendationMetrics.generation_created_total += created;
  return created;
};

/**
 * Generate fallback recommendations when collaborative filtering fails
 * Uses content-based filtering (same degree level, location, etc.)
 * 
 * @param userId - User UUID
 * @returns Number of recommendations created
 */
const generateFallbackRecommendations = async (userId: string): Promise<number> => {
  const sql = `
    WITH user_watchlist AS (
      -- Get user's saved programs
      SELECT admission_id
      FROM watchlists
      WHERE user_id = $1
    ),
    user_preferences AS (
      -- Extract patterns from user's watchlist
      SELECT 
        array_agg(DISTINCT a.degree_level) as preferred_degrees,
        array_agg(DISTINCT a.location) as preferred_locations,
        AVG(a.application_fee) as avg_fee
      FROM watchlists w
      INNER JOIN admissions a ON w.admission_id = a.id
      WHERE w.user_id = $1
    ),
    fallback_recommendations AS (
      -- Find similar programs based on content
      SELECT 
        $1 as user_id,
        a.id as admission_id,
        (
          -- Degree level match (40 points)
          CASE WHEN a.degree_level = ANY(up.preferred_degrees) THEN 40 ELSE 20 END +
          -- Location match (30 points)
          CASE WHEN a.location = ANY(up.preferred_locations) THEN 30 ELSE 10 END +
          -- Fee similarity (20 points)
          CASE 
            WHEN up.avg_fee IS NULL THEN 10
            WHEN ABS(a.application_fee - up.avg_fee) <= up.avg_fee * 0.2 THEN 20
            WHEN ABS(a.application_fee - up.avg_fee) <= up.avg_fee * 0.5 THEN 15
            ELSE 10
          END +
          -- Deadline proximity (10 points)
          CASE 
            WHEN a.deadline BETWEEN NOW() AND NOW() + INTERVAL '60 days' THEN 10
            WHEN a.deadline BETWEEN NOW() + INTERVAL '60 days' AND NOW() + INTERVAL '120 days' THEN 8
            ELSE 5
          END
        ) as score,
        CASE 
          WHEN a.degree_level = ANY(up.preferred_degrees) AND a.location = ANY(up.preferred_locations) THEN
            'Similar to programs you saved'
          WHEN a.degree_level = ANY(up.preferred_degrees) THEN
            'Same degree level as your saved programs'
          WHEN a.location = ANY(up.preferred_locations) THEN
            'Same location as your saved programs'
          ELSE
            'You might be interested in this'
        END as reason,
        json_build_object(
          'degree_match', CASE WHEN a.degree_level = ANY(up.preferred_degrees) THEN true ELSE false END,
          'location_match', CASE WHEN a.location = ANY(up.preferred_locations) THEN true ELSE false END,
          'algorithm', 'content_based_fallback'
        ) as factors
      FROM admissions a
      CROSS JOIN user_preferences up
      WHERE a.id NOT IN (SELECT admission_id FROM user_watchlist)
        AND a.verification_status = 'verified'
        AND a.deadline > NOW()
        AND a.is_active = true
      ORDER BY score DESC
      LIMIT 20
    )
    SELECT * FROM fallback_recommendations WHERE score >= 50;
  `;

  const result = await query(sql, [userId]);

  if (result.rows.length === 0) {
    console.log(`[Recommendations] No fallback recommendations found for user ${userId}`);
    return 0;
  }

  // Prepare recommendations for bulk insert
  const recommendations: CreateRecommendationDTO[] = result.rows.map((row: any) => ({
    user_id: row.user_id,
    admission_id: row.admission_id,
    score: row.score,
    reason: row.reason,
    factors: row.factors,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }));

  console.log(`[Recommendations] Generated ${recommendations.length} fallback recommendations`);
  
  return await recommendationsModel.bulkCreate(recommendations);
};

/**
 * Generate popular program recommendations for new users
 * Shows trending programs when user has no watchlist
 * 
 * @param userId - User UUID
 * @returns Number of recommendations created
 */
const generatePopularRecommendations = async (userId: string): Promise<number> => {
  const sql = `
    WITH popular_programs AS (
      -- Find most watched programs
      SELECT 
        $1 as user_id,
        a.id as admission_id,
        (
          -- Popularity score (50 points)
          LEAST(COUNT(DISTINCT w.user_id) * 5, 50) +
          -- Deadline proximity (30 points)
          CASE 
            WHEN a.deadline BETWEEN NOW() AND NOW() + INTERVAL '60 days' THEN 30
            WHEN a.deadline BETWEEN NOW() + INTERVAL '60 days' AND NOW() + INTERVAL '120 days' THEN 20
            ELSE 10
          END +
          -- Recently added (20 points)
          CASE 
            WHEN a.created_at >= NOW() - INTERVAL '30 days' THEN 20
            WHEN a.created_at >= NOW() - INTERVAL '60 days' THEN 15
            ELSE 10
          END
        ) as score,
        CASE 
          WHEN COUNT(DISTINCT w.user_id) >= 10 THEN
            'Popular among students (' || COUNT(DISTINCT w.user_id) || ' watching)'
          WHEN COUNT(DISTINCT w.user_id) >= 5 THEN
            'Trending program'
          ELSE
            'Featured program'
        END as reason,
        json_build_object(
          'popularity', COUNT(DISTINCT w.user_id),
          'algorithm', 'popular_programs'
        ) as factors
      FROM admissions a
      LEFT JOIN watchlists w ON w.admission_id = a.id
      WHERE a.verification_status = 'verified'
        AND a.deadline > NOW()
        AND a.is_active = true
      GROUP BY a.id
      ORDER BY score DESC
      LIMIT 20
    )
    SELECT * FROM popular_programs WHERE score >= 50;
  `;

  const result = await query(sql, [userId]);

  if (result.rows.length === 0) {
    console.log(`[Recommendations] No popular programs found for user ${userId}`);
    return 0;
  }

  // Prepare recommendations for bulk insert
  const recommendations: CreateRecommendationDTO[] = result.rows.map((row: any) => ({
    user_id: row.user_id,
    admission_id: row.admission_id,
    score: row.score,
    reason: row.reason,
    factors: row.factors,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }));

  console.log(`[Recommendations] Generated ${recommendations.length} popular recommendations`);
  
  return await recommendationsModel.bulkCreate(recommendations);
};

/**
 * Generate recommendations for all users (batch job)
 * Processes users in batches to avoid overloading the database
 * 
 * @param batchSize - Number of users to process per batch
 * @returns Total number of recommendations created
 */
export const generateRecommendationsForAllUsers = async (
  batchSize: number = 50
): Promise<{ usersProcessed: number; recommendationsCreated: number }> => {
  recommendationMetrics.batch_generation_runs_total += 1;

  // Get all student users with watchlists
  const getUsersSql = `
    SELECT DISTINCT u.id
    FROM users u
    INNER JOIN watchlists w ON u.id = w.user_id
    WHERE u.role = 'student'
    ORDER BY u.id
  `;
  
  const usersResult = await query(getUsersSql);
  const userIds = usersResult.rows.map((row: any) => row.id);

  let totalRecommendations = 0;
  let usersProcessed = 0;

  console.log(`[Recommendations] Starting batch generation for ${userIds.length} users...`);

  // Process users in batches
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    
    // Generate recommendations for each user in parallel
    const results = await Promise.all(
      batch.map(async (userId: string) => {
        try {
          const count = await generateRecommendationsForUser(userId);
          return count;
        } catch (error) {
          console.error(`[Recommendations] Error generating for user ${userId}:`, error);
          return 0;
        }
      })
    );

    const batchTotal = results.reduce((sum, count) => sum + count, 0);
    totalRecommendations += batchTotal;
    usersProcessed += batch.length;

    console.log(`[Recommendations] Batch ${Math.ceil(i / batchSize) + 1}: ${batch.length} users, ${batchTotal} recommendations`);
  }

  console.log(`[Recommendations] Batch generation complete: ${usersProcessed} users, ${totalRecommendations} recommendations`);

  return {
    usersProcessed,
    recommendationsCreated: totalRecommendations
  };
};

/**
 * Clean up expired recommendations
 * Should be run periodically (e.g., daily)
 * 
 * @returns Number of deleted recommendations
 */
export const cleanupExpiredRecommendations = async (): Promise<number> => {
  const count = await recommendationsModel.deleteExpired();
  console.log(`[Recommendations] Cleaned up ${count} expired recommendations`);
  return count;
};

/**
 * Refresh recommendations for a user (force regeneration)
 * 
 * @param userId - User UUID
 * @returns Number of new recommendations created
 */
export const refreshUserRecommendations = async (userId: string): Promise<number> => {
  recommendationMetrics.manual_refresh_total += 1;

  // Delete existing recommendations
  await recommendationsModel.deleteByUserId(userId);
  
  // Generate new recommendations
  return await generateRecommendationsForUser(userId);
};

/**
 * Get recommendation count for a user
 * 
 * @param userId - User UUID
 * @returns Total count of active recommendations
 */
export const getRecommendationCount = async (userId: string): Promise<number> => {
  return await recommendationsModel.countByUserId(userId);
};
