import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';
import { validateBody } from '@shared/middleware/validation';
import { chatRequestSchema, summarizeRequestSchema } from '../validators/ai.validators';

const router: Router = Router();

router.get('/health', aiController.health);
router.post('/chat', validateBody(chatRequestSchema), aiController.chat);
router.post('/summarize', validateBody(summarizeRequestSchema), aiController.summarize);

export default router;
