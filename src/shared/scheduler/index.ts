/**
 * Scheduled Tasks Module
 * 
 * Manages periodic background jobs for the application.
 * 
 * Jobs:
 * - Generate recommendations (daily at 2 AM)
 * - Clean up expired recommendations (daily at 3 AM)
 * - Send deadline reminders (every hour)
 */

import * as recommendationsService from '@domain/recommendations/services/recommendations.service';

/**
 * Generate recommendations for all users
 * Runs daily to keep recommendations fresh
 */
export const runRecommendationGeneration = async (): Promise<void> => {
  console.log('[Scheduler] Starting recommendation generation...');
  
  try {
    const result = await recommendationsService.generateRecommendationsForAllUsers(50);
    console.log(
      `[Scheduler] ✅ Recommendation generation complete: ${result.usersProcessed} users, ${result.recommendationsCreated} recommendations`
    );
  } catch (error) {
    console.error('[Scheduler] ❌ Recommendation generation failed:', error);
  }
};

/**
 * Clean up expired recommendations
 * Runs daily to keep the database clean
 */
export const runRecommendationCleanup = async (): Promise<void> => {
  console.log('[Scheduler] Starting recommendation cleanup...');
  
  try {
    const count = await recommendationsService.cleanupExpiredRecommendations();
    console.log(`[Scheduler] ✅ Cleanup complete: ${count} expired recommendations deleted`);
  } catch (error) {
    console.error('[Scheduler] ❌ Cleanup failed:', error);
  }
};

/**
 * Initialize all scheduled tasks
 * Call this on application startup
 */
export const initializeScheduler = (): void => {
  console.log('[Scheduler] Initializing scheduled tasks...');
  
  // For MVP: Simple setInterval approach (24 hours = 86400000ms)
  
  // Generate recommendations daily at 2 AM
  const scheduleRecommendationGeneration = () => {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(2, 0, 0, 0);
    
    // If 2 AM already passed today, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const msUntilRun = scheduledTime.getTime() - now.getTime();
    
    setTimeout(() => {
      runRecommendationGeneration();
      // Schedule next run (every 24 hours)
      setInterval(runRecommendationGeneration, 24 * 60 * 60 * 1000);
    }, msUntilRun);
    
    console.log(`[Scheduler] Recommendation generation scheduled for ${scheduledTime.toLocaleString()}`);
  };
  
  // Clean up expired recommendations daily at 3 AM
  const scheduleCleanup = () => {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(3, 0, 0, 0);
    
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const msUntilRun = scheduledTime.getTime() - now.getTime();
    
    setTimeout(() => {
      runRecommendationCleanup();
      setInterval(runRecommendationCleanup, 24 * 60 * 60 * 1000);
    }, msUntilRun);
    
    console.log(`[Scheduler] Cleanup scheduled for ${scheduledTime.toLocaleString()}`);
  };
  
  scheduleRecommendationGeneration();
  scheduleCleanup();
  
  console.log('[Scheduler] ✅ All scheduled tasks initialized');
  console.log('[Scheduler] 💡 Tip: Use POST /api/v1/recommendations/generate-all to trigger manually');
};

/**
 * Run initial recommendation generation on startup (optional)
 * Useful for fresh deployments or testing
 */
export const runStartupJobs = async (): Promise<void> => {
  console.log('[Scheduler] Running startup jobs...');
  
  // Check if recommendations table is empty and generate if needed
  // This is optional - comment out if you want to wait for the scheduled time
  
  // await runRecommendationGeneration();
  
  console.log('[Scheduler] ✅ Startup jobs complete');
};
