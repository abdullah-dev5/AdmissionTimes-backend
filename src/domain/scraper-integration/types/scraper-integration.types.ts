export type ScraperIngestionMode = 'mirror' | 'publish';
export type ScraperEventStatus = 'mirrored' | 'inserted' | 'updated' | 'skipped' | 'failed';

export interface ScrapedAdmissionIngestDTO {
  source_university_name: string;
  source_program_title: string;
  source_last_date: string;
  source_details_link: string;
  source_publish_date?: string | null;
  programs_offered?: string[];
  scraping_metadata?: Record<string, any>;
}

export interface ScraperIngestBatchRequestDTO {
  records: ScrapedAdmissionIngestDTO[];
  requested_by?: string;
  university_scope?: string;
  force_publish?: boolean;
}

export interface ScraperIngestionSummary {
  run_id: string;
  mode: ScraperIngestionMode;
  fetched_count: number;
  mirrored_count: number;
  published_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  status: 'completed' | 'failed' | 'partial';
}

export interface ScraperRunSummary {
  total_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
  running_jobs: number;
  last_execution: string | null;
}

export interface ScraperRunListItem {
  id: string;
  job_id: string;
  university: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'partial';
  status_label: 'Success' | 'Failed' | 'No Changes' | 'Changes Detected' | 'Running';
  source_url: string | null;
  duration_seconds: number;
  scheduler_triggered: boolean;
  changes_detected: number;
  fetched_count: number;
  mirrored_count: number;
  published_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
}

export interface ScraperRunEventItem {
  id: string;
  event_status: ScraperEventStatus;
  source_university_name: string | null;
  source_program_title: string | null;
  source_last_date: string | null;
  source_details_link: string | null;
  reason: string | null;
  error_detail: string | null;
  created_at: string;
}

export interface ScraperRunUniversityBreakdownItem {
  source_university_name: string;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface ScraperRunSkipReasonItem {
  source_university_name: string;
  reason: string;
  count: number;
}

export interface ScraperRunDetail {
  run: ScraperRunListItem;
  events: ScraperRunEventItem[];
  university_breakdown: ScraperRunUniversityBreakdownItem[];
  skip_reasons: ScraperRunSkipReasonItem[];
}

export interface ScraperManualRunRequestDTO {
  force_publish?: boolean;
}

export interface ScraperManualRunResult {
  source_run_id: string;
  replayed_records: number;
  ingestion: ScraperIngestionSummary;
}
