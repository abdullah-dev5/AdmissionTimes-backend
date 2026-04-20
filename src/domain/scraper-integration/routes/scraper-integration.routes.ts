import { Router } from 'express';
import * as scraperIntegrationController from '../controllers/scraper-integration.controller';
import { requireInternalServiceToken } from '@shared/middleware/internalServiceAuth';

const router: Router = Router();

router.get('/health', requireInternalServiceToken, scraperIntegrationController.health);
router.post('/ingest-batch', requireInternalServiceToken, scraperIntegrationController.ingestBatchController);

export default router;
