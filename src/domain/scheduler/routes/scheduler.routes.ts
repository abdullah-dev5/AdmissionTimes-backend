import { Router } from 'express';
import { triggerDeadlineReminders } from '@domain/deadlines/controllers/deadlines.controller';
import { requireRole } from '@shared/middleware/jwtAuth';
import { getSchedulerHealth, getReminderLogs } from '../controllers/scheduler.controller';

const router: Router = Router();

// GET /api/v1/scheduler/health
// Get scheduler health metrics (admin only)
router.get('/health', requireRole(['admin']), getSchedulerHealth);

// GET /api/v1/scheduler/reminder-logs
// Get recent reminder delivery outcomes (admin only)
router.get('/reminder-logs', requireRole(['admin']), getReminderLogs);

// POST /api/v1/scheduler/reminder
// Trigger deadline reminder notifications (admin only)
router.post('/reminder', requireRole(['admin']), triggerDeadlineReminders);

export default router;
