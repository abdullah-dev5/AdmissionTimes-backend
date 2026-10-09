import Joi from 'joi';

/** One scraper run sends at most this many records per request. */
export const MAX_INGEST_RECORDS = 500;

const scrapedRecordSchema = Joi.object({
  source_university_name: Joi.string().trim().min(2).max(255).required(),
  source_program_title: Joi.string().trim().min(2).max(500).required(),
  source_last_date: Joi.string().trim().max(100).required(),
  source_details_link: Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(2048).allow('').required(),
  source_publish_date: Joi.string().trim().max(100).allow('', null).optional(),
  programs_offered: Joi.array().items(Joi.string().trim().max(500)).max(200).optional(),
  scraping_metadata: Joi.object().unknown(true).optional(),
});

export const ingestBatchSchema = Joi.object({
  records: Joi.array().items(scrapedRecordSchema).min(1).max(MAX_INGEST_RECORDS).required(),
  requested_by: Joi.string().trim().max(100).optional(),
  university_scope: Joi.string().trim().max(255).optional(),
  force_publish: Joi.boolean().optional(),
});
