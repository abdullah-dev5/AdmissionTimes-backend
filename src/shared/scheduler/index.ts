/**
 * Scheduled Tasks
 *
 * Background jobs run in-process with node-cron. Each job is guarded against
 * overlapping runs and records health metrics for /api/v1/scheduler/health.
 *
 * Run the scheduler in exactly ONE process (SCHEDULER_ENABLED=false on extra
 * API replicas); notification event keys make reminder dispatch idempotent,
 * but other jobs would still do duplicate work.
 */

import * as cron from 'node-cron';
import * as recommendationsService from '@domain/recommendations/services/recommendations.service';
import * as deadlinesService from '@domain/deadlines/services/deadlines.service';
import * as notificationsService from '@domain/notifications/services/notifications.service';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('Scheduler');

interface JobMetrics {
  lastRunAt: string | null;
  lastDurationMs: number | null;
  lastStatus: 'success' | 'error' | 'skipped' | null;
  totalRuns: number;
  totalFailures: number;
  lastError: string | null;
  lastResult: unknown;
}

type JobName =
  | 'recommendationGeneration'
  | 'recommendationCleanup'
  | 'deadlineReminders'
  | 'emailRetryDispatch';

const newMetrics = (): JobMetrics => ({
  lastRunAt: null,
  lastDurationMs: null,
  lastStatus: null,
  totalRuns: 0,
  totalFailures: 0,
  lastError: null,
  lastResult: null,
});

const schedulerMetrics: Record<JobName, JobMetrics> = {
  recommendationGeneration: newMetrics(),
  recommendationCleanup: newMetrics(),
  deadlineReminders: newMetrics(),
  emailRetryDispatch: newMetrics(),
};

const running = new Set<JobName>();
const tasks: cron.ScheduledTask[] = [];
const timers: NodeJS.Timeout[] = [];

export const getSchedulerMetrics = (): Record<JobName, JobMetrics> => ({ ...schedulerMetrics });

/**
 * Run a job with overlap protection and metrics. Never throws.
 */
const runJob = async (name: JobName, work: () => Promise<unknown>): Promise<void> => {
  const metrics = schedulerMetrics[name];

  if (running.has(name)) {
    metrics.lastStatus = 'skipped';
    log.warn(`${name} skipped: previous run still in progress`);
    return;
  }

  running.add(name);
  const startedAt = Date.now();
  metrics.totalRuns += 1;
  metrics.lastRunAt = new Date(startedAt).toISOString();

  try {
    const result = await work();
    metrics.lastStatus = 'success';
    metrics.lastError = null;
    metrics.lastResult = result ?? null;
    log.info(`${name} completed in ${Date.now() - startedAt}ms`, result ?? '');
  } catch (error) {
    metrics.lastStatus = 'error';
    metrics.totalFailures += 1;
    metrics.lastError = error instanceof Error ? error.message : String(error);
    log.error(`${name} failed`, metrics.lastError);
  } finally {
    metrics.lastDurationMs = Date.now() - startedAt;
    running.delete(name);
  }
};

export const runRecommendationGeneration = (): Promise<void> =>
  runJob('recommendationGeneration', () => recommendationsService.generateRecommendationsForAllUsers(50));

export const runRecommendationCleanup = (): Promise<void> =>
  runJob('recommendationCleanup', async () => ({
    deleted: await recommendationsService.cleanupExpiredRecommendations(),
  }));

export const runDeadlineReminderDispatch = (): Promise<void> =>
  runJob('deadlineReminders', () => deadlinesService.triggerDeadlineReminderNotifications([7, 3, 1]));

export const runEmailRetryDispatch = (): Promise<void> =>
  runJob('emailRetryDispatch', () =>
    notificationsService.processEmailRetries({ limit: 50, maxFailedAttempts: 6, minAgeSeconds: 60 })
  );

/**
 * Register all cron jobs. Call once on startup.
 */
export const initializeScheduler = (): void => {
  tasks.push(
    cron.schedule('5 * * * *', () => void runDeadlineReminderDispatch()),
    cron.schedule('*/5 * * * *', () => void runEmailRetryDispatch()),
    cron.schedule('0 1 * * *', () => void runRecommendationCleanup()),
    cron.schedule('0 2 * * *', () => void runRecommendationGeneration()),
    cron.schedule('30 4 * * *', () => void runRecommendationCleanup())
  );

  // Catch-up runs shortly after boot so a restart never skips a window.
  timers.push(
    setTimeout(() => void runDeadlineReminderDispatch(), 15_000),
    setTimeout(() => void runEmailRetryDispatch(), 30_000)
  );

  log.info(
    'Jobs registered: reminders "5 * * * *", email retry "*/5 * * * *", ' +
      'rec cleanup "0 1 * * *" + "30 4 * * *", rec generation "0 2 * * *"'
  );
};

export const stopScheduler = (): void => {
  timers.splice(0).forEach(clearTimeout);
  tasks.splice(0).forEach((task) => task.stop());
};
