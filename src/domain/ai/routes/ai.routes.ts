import { Router } from 'express';
import * as aiController from '../controllers/ai.controller';
import { validateBody } from '@shared/middleware/validation';
import { chatRequestSchema, compareProgramsRequestSchema, summarizeRequestSchema } from '../validators/ai.validators';

const router: Router = Router();

router.get('/health', aiController.health);
router.post('/chat', validateBody(chatRequestSchema), aiController.chat);
router.post('/summarize', validateBody(summarizeRequestSchema), aiController.summarize);
router.post('/compare', validateBody(compareProgramsRequestSchema), aiController.comparePrograms);

export default router;
