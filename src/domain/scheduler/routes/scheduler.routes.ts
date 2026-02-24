import { Router } from 'express';
import { triggerDeadlineReminders } from '@domain/deadlines/controllers/deadlines.controller';

const router: Router = Router();

// POST /api/v1/scheduler/reminder
// Trigger deadline reminder notifications (admin only)
router.post('/reminder', triggerDeadlineReminders);

export default router;
