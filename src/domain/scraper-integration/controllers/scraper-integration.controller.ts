import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import { config } from '@config/config';
import {
  ingestBatch,
  getScraperRunSummary,
  getScraperRuns,
  getScraperRunDetail,
  triggerManualRunAll,
  triggerManualRerun,
} from '../services/scraper-integration.service';
import { ScraperIngestBatchRequestDTO, ScraperManualRunRequestDTO } from '../types/scraper-integration.types';

export const health = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    sendSuccess(res, {
      enabled: config.scraperIntegration.enabled,
      publish_enabled: config.scraperIntegration.publishEnabled,
      mode: config.scraperIntegration.publishEnabled ? 'publish' : 'mirror',
    }, 'Scraper integration health retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const ingestBatchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as ScraperIngestBatchRequestDTO;
    const result = await ingestBatch(payload);
    sendSuccess(res, result, 'Scraper batch ingested successfully');
  } catch (error) {
    next(error);
  }
};

export const getRunSummaryController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await getScraperRunSummary();
    sendSuccess(res, summary, 'Scraper run summary retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getRunsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const status = req.query.status ? String(req.query.status) : undefined;
    const mode = req.query.mode ? String(req.query.mode) : undefined;

    const { runs, total } = await getScraperRuns(page, limit, status, mode);
    sendPaginated(
      res,
      runs,
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      'Scraper ingestion runs retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

export const getRunDetailController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const runId = String(req.params.id || '').trim();
    const detail = await getScraperRunDetail(runId);
    sendSuccess(res, detail, 'Scraper ingestion run detail retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const manualRunAllController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const payload = (req.body || {}) as ScraperManualRunRequestDTO;
    const requestedBy = `admin:${String(req.user?.id || 'unknown')}`;
    const result = await triggerManualRunAll(requestedBy, payload.force_publish);
    sendSuccess(res, result, 'Manual scraper run triggered successfully');
  } catch (error) {
    next(error);
  }
};

export const manualRerunController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const runId = String(req.params.id || '').trim();
    const payload = (req.body || {}) as ScraperManualRunRequestDTO;
    const requestedBy = `admin:${String(req.user?.id || 'unknown')}`;
    const result = await triggerManualRerun(runId, requestedBy, payload.force_publish);
    sendSuccess(res, result, 'Manual scraper rerun triggered successfully');
  } catch (error) {
    next(error);
  }
};
