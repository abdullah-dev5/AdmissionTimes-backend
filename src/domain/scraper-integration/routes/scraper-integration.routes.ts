import { Router } from 'express';
import * as scraperIntegrationController from '../controllers/scraper-integration.controller';
import { requireInternalServiceToken } from '@shared/middleware/internalServiceAuth';
import { validateBody } from '@shared/middleware/validation';
import { ingestBatchSchema } from '../validators/scraper-integration.validators';

const router: Router = Router();

router.get('/health', requireInternalServiceToken, scraperIntegrationController.health);
router.post(
  '/ingest-batch',
  requireInternalServiceToken,
  validateBody(ingestBatchSchema),
  scraperIntegrationController.ingestBatchController
);

export default router;
