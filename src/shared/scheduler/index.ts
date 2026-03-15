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
import * as deadlinesService from '@domain/deadlines/services/deadlines.service';

/**
 * Runtime metrics for scheduler health monitoring
 */
interface JobMetrics {
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastStatus: 'success' | 'error' | null;
  totalRuns: number;
  totalFailures: number;
  lastError: string | null;
}

interface SchedulerMetrics {
  recommendationGeneration: JobMetrics;
  recommendationCleanup: JobMetrics;
  deadlineReminders: JobMetrics;
}

const schedulerMetrics: SchedulerMetrics = {
  recommendationGeneration: {
    lastRunAt: null,
    lastDurationMs: null,
    lastStatus: null,
    totalRuns: 0,
    totalFailures: 0,
    lastError: null,
  },
  recommendationCleanup: {
    lastRunAt: null,
    lastDurationMs: null,
    lastStatus: null,
    totalRuns: 0,
    totalFailures: 0,
    lastError: null,
  },
  deadlineReminders: {
    lastRunAt: null,
    lastDurationMs: null,
    lastStatus: null,
    totalRuns: 0,
    totalFailures: 0,
    lastError: null,
  },
};

/**
 * Get current scheduler health metrics
 */
export const getSchedulerMetrics = (): SchedulerMetrics => {
  return { ...schedulerMetrics };
};

/**
 * Generate recommendations for all users
 * Runs daily to keep recommendations fresh
 */
export const runRecommendationGeneration = async (): Promise<void> => {
  const startTime = Date.now();
  console.log('[Scheduler] Starting recommendation generation...');
  
  schedulerMetrics.recommendationGeneration.totalRuns += 1;
  schedulerMetrics.recommendationGeneration.lastRunAt = new Date().toISOString();

  try {
    const result = await recommendationsService.generateRecommendationsForAllUsers(50);
    const durationMs = Date.now() - startTime;

    schedulerMetrics.recommendationGeneration.lastStatus = 'success';
    schedulerMetrics.recommendationGeneration.lastDurationMs = durationMs;
    schedulerMetrics.recommendationGeneration.lastError = null;

    console.log(
      `[Scheduler] ✅ Recommendation generation complete: ${result.usersProcessed} users, ${result.recommendationsCreated} recommendations (${durationMs}ms)`
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    schedulerMetrics.recommendationGeneration.lastStatus = 'error';
    schedulerMetrics.recommendationGeneration.lastDurationMs = durationMs;
    schedulerMetrics.recommendationGeneration.totalFailures += 1;
    schedulerMetrics.recommendationGeneration.lastError = errorMessage;

    console.error('[Scheduler] ❌ Recommendation generation failed:', error);
  }
};

/**
 * Clean up expired recommendations
 * Runs daily to keep the database clean
 */
export const runRecommendationCleanup = async (): Promise<void> => {
  const startTime = Date.now();
  console.log('[Scheduler] Starting recommendation cleanup...');
  
  schedulerMetrics.recommendationCleanup.totalRuns += 1;
  schedulerMetrics.recommendationCleanup.lastRunAt = new Date().toISOString();

  try {
    const count = await recommendationsService.cleanupExpiredRecommendations();
    const durationMs = Date.now() - startTime;

    schedulerMetrics.recommendationCleanup.lastStatus = 'success';
    schedulerMetrics.recommendationCleanup.lastDurationMs = durationMs;
    schedulerMetrics.recommendationCleanup.lastError = null;

    console.log(`[Scheduler] ✅ Cleanup complete: ${count} expired recommendations deleted (${durationMs}ms)`);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    schedulerMetrics.recommendationCleanup.lastStatus = 'error';
    schedulerMetrics.recommendationCleanup.lastDurationMs = durationMs;
    schedulerMetrics.recommendationCleanup.totalFailures += 1;
    schedulerMetrics.recommendationCleanup.lastError = errorMessage;

    console.error('[Scheduler] ❌ Cleanup failed:', error);
  }
};

/**
 * Trigger deadline reminders for threshold days (7, 3, 1)
 * Runs hourly to ensure timely dispatch.
 */
export const runDeadlineReminderDispatch = async (): Promise<void> => {
  const startTime = Date.now();
  console.log('[Scheduler] Starting deadline reminder dispatch...');

  schedulerMetrics.deadlineReminders.totalRuns += 1;
  schedulerMetrics.deadlineReminders.lastRunAt = new Date().toISOString();

  try {
    const result = await deadlinesService.triggerDeadlineReminderNotifications([7, 3, 1]);
    const durationMs = Date.now() - startTime;

    schedulerMetrics.deadlineReminders.lastStatus = 'success';
    schedulerMetrics.deadlineReminders.lastDurationMs = durationMs;
    schedulerMetrics.deadlineReminders.lastError = null;

    const successRate = result.attempted > 0
      ? ((result.succeeded / result.attempted) * 100).toFixed(1)
      : '100.0';

    console.log(
      `[Scheduler] ✅ Deadline reminders complete: targets=${result.targets}, attempted=${result.attempted}, succeeded=${result.succeeded}, deduped=${result.deduped}, failed=${result.failed} (${successRate}% success, ${durationMs}ms)`
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    schedulerMetrics.deadlineReminders.lastStatus = 'error';
    schedulerMetrics.deadlineReminders.lastDurationMs = durationMs;
    schedulerMetrics.deadlineReminders.totalFailures += 1;
    schedulerMetrics.deadlineReminders.lastError = errorMessage;

    console.error('[Scheduler] ❌ Deadline reminder dispatch failed:', error);
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

  // Run deadline reminders hourly at the start of the hour
  const scheduleDeadlineReminders = () => {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setMinutes(0, 0, 0);
    scheduledTime.setHours(scheduledTime.getHours() + 1);

    const msUntilRun = scheduledTime.getTime() - now.getTime();

    // Run once shortly after startup so we don't wait until the top of next hour
    setTimeout(() => {
      console.log('[Scheduler] Running initial deadline reminder dispatch on startup...');
      runDeadlineReminderDispatch().catch((error) => {
        console.error('[Scheduler] ❌ Initial deadline reminder dispatch failed:', error);
      });
    }, 15000);

    setTimeout(() => {
      runDeadlineReminderDispatch();
      // Schedule next runs every hour
      setInterval(runDeadlineReminderDispatch, 60 * 60 * 1000);
    }, msUntilRun);

    console.log(`[Scheduler] Deadline reminders scheduled for ${scheduledTime.toLocaleString()} (hourly)`);
  };
  
  scheduleRecommendationGeneration();
  scheduleCleanup();
  scheduleDeadlineReminders();
  
  console.log('[Scheduler] ✅ All scheduled tasks initialized');
  console.log('[Scheduler] 💡 Tips: Use POST /api/v1/recommendations/generate-all and POST /api/v1/scheduler/reminder for manual triggers');
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
