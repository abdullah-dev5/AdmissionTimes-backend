/**
 * Scheduled Tasks Module
 * 
 * Manages periodic background jobs for the application.
 * Uses node-cron for production-grade scheduling.
 * 
 * Jobs:
 * - Generate recommendations (daily at 2 AM)
 * - Clean up expired recommendations (daily at 3 AM)
 * - Send deadline reminders (every hour at minute 5)
 */

import * as recommendationsService from '@domain/recommendations/services/recommendations.service';
import * as deadlinesService from '@domain/deadlines/services/deadlines.service';
import * as notificationsService from '@domain/notifications/services/notifications.service';
import * as cron from 'node-cron';

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
  emailRetryDispatch: JobMetrics;
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
  emailRetryDispatch: {
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
 * Process failed email deliveries for retry/catch-up.
 * Runs every 5 minutes to recover from transient delivery failures.
 */
export const runEmailRetryDispatch = async (): Promise<void> => {
  const startTime = Date.now();
  console.log('[Scheduler] Starting email retry dispatch...');

  schedulerMetrics.emailRetryDispatch.totalRuns += 1;
  schedulerMetrics.emailRetryDispatch.lastRunAt = new Date().toISOString();

  try {
    const result = await notificationsService.processEmailRetries({
      limit: 50,
      maxFailedAttempts: 6,
      minAgeSeconds: 60,
    });
    const durationMs = Date.now() - startTime;

    schedulerMetrics.emailRetryDispatch.lastStatus = 'success';
    schedulerMetrics.emailRetryDispatch.lastDurationMs = durationMs;
    schedulerMetrics.emailRetryDispatch.lastError = null;

    console.log(
      `[Scheduler] ✅ Email retry dispatch complete: backlog=${result.backlog}, queued=${result.queued}, attempted=${result.attempted} (${durationMs}ms)`
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    schedulerMetrics.emailRetryDispatch.lastStatus = 'error';
    schedulerMetrics.emailRetryDispatch.lastDurationMs = durationMs;
    schedulerMetrics.emailRetryDispatch.totalFailures += 1;
    schedulerMetrics.emailRetryDispatch.lastError = errorMessage;

    console.error('[Scheduler] ❌ Email retry dispatch failed:', error);
  }
};

/**
 * Initialize all scheduled tasks using node-cron
 * Call this on application startup
 */
export const initializeScheduler = (): void => {
  console.log('[Scheduler] Initializing scheduled tasks with node-cron...');

  // ✅ Run deadline reminders every hour at minute 5
  // Spreads load if multiple servers; gives job 55-minute SLA
  const deadlineReminderTask = cron.schedule('5 * * * *', async () => {
    console.log('[Scheduler] Deadline reminder job triggered...');
    try {
      await runDeadlineReminderDispatch();
    } catch (error) {
      console.error('[Scheduler] ❌ Deadline reminder failed:', error);
    }
  });

  // ✅ Run recommendations generation daily at 2 AM
  const recommendationTask = cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Recommendation generation job triggered...');
    try {
      await runRecommendationGeneration();
    } catch (error) {
      console.error('[Scheduler] ❌ Recommendation generation failed:', error);
    }
  });

  // ✅ Clean up expired recommendations daily at 3 AM
  const cleanupTask = cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Cleanup job triggered...');
    try {
      await runRecommendationCleanup();
    } catch (error) {
      console.error('[Scheduler] ❌ Cleanup failed:', error);
    }
  });

  // ✅ Retry failed email deliveries every 5 minutes
  const emailRetryTask = cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Email retry job triggered...');
    try {
      await runEmailRetryDispatch();
    } catch (error) {
      console.error('[Scheduler] ❌ Email retry dispatch failed:', error);
    }
  });

  // ✅ Run initial deadline reminder check on startup (15 seconds delay)
  // Ensures reminders fire even if server starts just after hourly window
  setTimeout(() => {
    console.log('[Scheduler] Running initial deadline reminder on startup...');
    runDeadlineReminderDispatch().catch((error) => {
      console.error('[Scheduler] ❌ Initial deadline reminder failed:', error);
    });
  }, 15000);

  // ✅ Run initial email retry catch-up on startup (30 seconds delay)
  setTimeout(() => {
    console.log('[Scheduler] Running initial email retry catch-up on startup...');
    runEmailRetryDispatch().catch((error) => {
      console.error('[Scheduler] ❌ Initial email retry catch-up failed:', error);
    });
  }, 30000);

  console.log('[Scheduler] ✅ All scheduled tasks initialized (using node-cron)');
  console.log('[Scheduler] 💡 Cron patterns:');
  console.log('[Scheduler]   - Deadline reminders: "5 * * * *" (every hour at minute 5)');
  console.log('[Scheduler]   - Email retries: "*/5 * * * *" (every 5 minutes)');
  console.log('[Scheduler]   - Recommendations: "0 2 * * *" (daily at 2 AM)');
  console.log('[Scheduler]   - Cleanup: "0 3 * * *" (daily at 3 AM)');
  console.log('[Scheduler] 💡 Tips: Use POST /api/v1/recommendations/generate-all and POST /api/v1/scheduler/reminder for manual triggers');

  // Graceful shutdown: stop all cron jobs
  process.on('SIGTERM', () => {
    console.log('[Scheduler] Stopping cron tasks...');
    deadlineReminderTask.stop();
    emailRetryTask.stop();
    recommendationTask.stop();
    cleanupTask.stop();
  });

  process.on('SIGINT', () => {
    console.log('[Scheduler] Stopping cron tasks (SIGINT)...');
    deadlineReminderTask.stop();
    emailRetryTask.stop();
    recommendationTask.stop();
    cleanupTask.stop();
  });
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
