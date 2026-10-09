import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';
import { validateBody } from '@shared/middleware/validation';
import { chatRequestSchema, compareProgramsRequestSchema, summarizeRequestSchema } from '../validators/ai.validators';
import { userRateLimit } from '@shared/middleware/userRateLimit';
import { requireRole } from '@shared/middleware/jwtAuth';

const router: Router = Router();

router.get('/health', aiController.health);
router.post(
  '/chat',
  userRateLimit({
    scope: 'ai-chat',
    limit: 8,
    windowMs: 60_000,
    message: 'Too many AI chat requests. Please try again in a minute.',
  }),
  validateBody(chatRequestSchema),
  aiController.chat
);
router.post(
  '/summarize',
  requireRole(['university', 'admin']),
  userRateLimit({
    scope: 'ai-summarize',
    limit: 4,
    windowMs: 60_000,
    message: 'Too many AI summary requests. Please try again in a minute.',
  }),
  validateBody(summarizeRequestSchema),
  aiController.summarize
);
router.post(
  '/compare',
  userRateLimit({
    scope: 'ai-compare',
    limit: 6,
    windowMs: 60_000,
    message: 'Too many comparison requests. Please try again in a minute.',
  }),
  validateBody(compareProgramsRequestSchema),
  aiController.comparePrograms
);

export default router;
