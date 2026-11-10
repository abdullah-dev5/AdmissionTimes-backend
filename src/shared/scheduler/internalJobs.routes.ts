/**
 * POST /api/v1/internal/jobs/:job — run a scheduled job on demand.
 *
 * For hosts that sleep when idle (Render free): an external scheduler
 * (cron-job.org, GitHub Actions) calls this so reminders and email retries
 * still run on time. Protected by CRON_SECRET in the x-internal-service-token
 * header. Jobs are guarded against overlapping runs, and reminder dispatch is
 * idempotent, so running them both here and in-process is safe.
 */

import { Router, Request, Response } from 'express';
import { requireCronSecret } from '@shared/middleware/internalServiceAuth';
import { sendSuccess } from '@shared/utils/response';
import { AppError } from '@shared/middleware/errorHandler';
import { getSchedulerMetrics, runDeadlineReminderDispatch, runEmailRetryDispatch, runRecommendationCleanup, runRecommendationGeneration } from './index';

const JOBS: Record<string, () => Promise<void>> = {
  reminders: runDeadlineReminderDispatch,
  'email-retries': runEmailRetryDispatch,
  'recommendations': runRecommendationGeneration,
  'recommendation-cleanup': runRecommendationCleanup,
};

const router: Router = Router();

router.post('/:job', requireCronSecret, (req: Request, res: Response) => {
  const run = JOBS[String(req.params.job)];
  if (!run) throw new AppError(`Unknown job. Use one of: ${Object.keys(JOBS).join(', ')}`, 404);
  // Answer at once (schedulers time out after ~30 s); the job keeps running.
  void run();
  sendSuccess(res, { job: req.params.job, started: true }, 'Job started', 202);
});

router.get('/', requireCronSecret, (_req: Request, res: Response) => {
  sendSuccess(res, getSchedulerMetrics(), 'Scheduler metrics');
});

export default router;
