import { Router } from 'express';
import { triggerDeadlineReminders } from '@domain/deadlines/controllers/deadlines.controller';
import { getSchedulerHealth } from '../controllers/scheduler.controller';

const router: Router = Router();

// GET /api/v1/scheduler/health
// Get scheduler health metrics (admin only)
router.get('/health', getSchedulerHealth);

// POST /api/v1/scheduler/reminder
// Trigger deadline reminder notifications (admin only)
router.post('/reminder', triggerDeadlineReminders);

export default router;
