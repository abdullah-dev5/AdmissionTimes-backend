import crypto from 'crypto';
import { query } from '@db/connection';
import { config } from '@config/config';
import { AppError } from '@shared/middleware/errorHandler';
import {
  ScraperIngestBatchRequestDTO,
  ScraperIngestionMode,
  ScraperIngestionSummary,
  ScrapedAdmissionIngestDTO,
  ScraperEventStatus,
  ScraperRunSummary,
  ScraperRunListItem,
  ScraperRunUniversityBreakdownItem,
  ScraperRunSkipReasonItem,
  ScraperRunDetail,
  ScraperRunEventItem,
  ScraperManualRunResult,
} from '../types/scraper-integration.types';
const normalizeText = (value: unknown): string => String(value || '').trim();
const normalizeUniversityKey = (value: unknown): string =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const UNIVERSITY_ALIASES: Record<string, string[]> = {
  'fast university': ['fast', 'fast university', 'fast nuces', 'national university of computer and emerging sciences'],
  'giki': ['giki', 'gik institute', 'gik institute of engineering sciences and technology', 'ghulam ishaq khan institute', 'ghulam ishaq khan institute of engineering sciences and technology'],
  'iba karachi': ['iba karachi', 'institute of business administration', 'institute of business administration karachi', 'iba'],
  'iba sukkur': ['iba sukkur', 'sukkur iba university', 'sukkur iba'],
  'nutech': ['nutech', 'national university of technology', 'national university of technology nutech', 'national university of technology islamabad'],
  'muhammad ali jinnah university': ['muhammad ali jinnah university', 'm a jinnah university', 'maju', 'jinnah university'],
};

const expandUniversityCandidates = (sourceUniversityName: string): { rawCandidates: string[]; normalizedCandidates: string[] } => {
  const raw = normalizeText(sourceUniversityName).toLowerCase();
  if (!raw) return { rawCandidates: [], normalizedCandidates: [] };

  const rawCandidates = new Set<string>([raw]);
  const normalizedCandidates = new Set<string>([normalizeUniversityKey(raw)]);

  // Add common textual reductions from scraper source names.
  const withoutParen = raw.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const withoutCommaTail = raw.split(',')[0].trim();
  const compact = raw.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  [withoutParen, withoutCommaTail, compact].forEach((candidate) => {
    if (!candidate) return;
    rawCandidates.add(candidate);
    normalizedCandidates.add(normalizeUniversityKey(candidate));
  });

  const addAliasGroup = (aliases: string[]) => {
    aliases.forEach((alias) => {
      const cleaned = normalizeText(alias).toLowerCase();
      if (!cleaned) return;
      rawCandidates.add(cleaned);
      normalizedCandidates.add(normalizeUniversityKey(cleaned));
    });
  };

  for (const aliases of Object.values(UNIVERSITY_ALIASES)) {
    const aliasSet = new Set(aliases.map((a) => normalizeText(a).toLowerCase()));
    const hasMatch = Array.from(rawCandidates).some((candidate) => aliasSet.has(candidate));
    if (hasMatch) {
      addAliasGroup(aliases);
    }
  }

  return {
    rawCandidates: Array.from(rawCandidates).filter(Boolean),
    normalizedCandidates: Array.from(normalizedCandidates).filter(Boolean),
  };
};

const toIsoDateOrNull = (value: string | null | undefined): string | null => {
  const text = normalizeText(value);
  if (!text) return null;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const inferDegreeLevelFromTitle = (title: string): string | null => {
  const text = normalizeText(title).toLowerCase();
  if (!text) return null;

  if (/\bbba\b|bachelor of business administration/.test(text)) return 'BBA';
  if (/\bmba\b|master of business administration/.test(text)) return 'MBA';
  if (/\bphd\b|doctor of philosophy|doctorate/.test(text)) return 'PhD';
  if (/\bmd\b|doctor of medicine/.test(text)) return 'MD';
  if (/\bmphil\b|master of philosophy/.test(text)) return 'MPhil';
  if (/\bms\b|master of science|\bmaster\b/.test(text)) return 'MS';
  if (/\bbs\b|bachelor of science|\bbe\b|bachelor|undergraduate/.test(text)) return 'BS';

  return null;
};

const buildFallbackDescription = (
  title: string,
  universityName: string,
  degreeLevel: string | null,
  location: string | null,
): string => {
  const degreeText = normalizeText(degreeLevel) || 'Degree Not Specified';
  const locationText = normalizeText(location) || 'Location not specified';
  return `${normalizeText(title)} at ${normalizeText(universityName)} is a ${degreeText} program located in ${locationText}.`;
};

const computeSourceHash = (record: ScrapedAdmissionIngestDTO): string => {
  const payload = {
    source_university_name: normalizeText(record.source_university_name).toLowerCase(),
    source_program_title: normalizeText(record.source_program_title).toLowerCase(),
    source_details_link: normalizeText(record.source_details_link),
    source_last_date: normalizeText(record.source_last_date),
  };

  const blob = JSON.stringify(payload);
  return crypto.createHash('md5').update(blob).digest('hex');
};

const ensureUniversityExists = async (sourceUniversityName: string): Promise<string | null> => {
  const name = normalizeText(sourceUniversityName);
  if (!name) return null;

  const existing = await query(
    `
      SELECT id::text AS id
      FROM universities
      WHERE lower(name) = lower($1)
      LIMIT 1
    `,
    [name]
  );

  if (existing.rows[0]?.id) {
    return String(existing.rows[0].id);
  }

  const inserted = await query(
    `
      INSERT INTO universities (name, is_active)
      VALUES ($1, true)
      RETURNING id::text AS id
    `,
    [name]
  );

  return inserted.rows[0]?.id ? String(inserted.rows[0].id) : null;
};

const resolveUniversityId = async (sourceUniversityName: string): Promise<string | null> => {
  const candidates = expandUniversityCandidates(sourceUniversityName);
  if (!candidates.rawCandidates.length) return null;

  const result = await query(
    `
      SELECT id::text AS id
      FROM universities
      WHERE lower(name) = ANY($1::text[])
         OR regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') = ANY($2::text[])
         OR EXISTS (
           SELECT 1
           FROM unnest($1::text[]) AS c(candidate)
           WHERE lower(name) LIKE c.candidate || '%'
              OR c.candidate LIKE lower(name) || '%'
         )
         OR EXISTS (
            SELECT 1
            FROM unnest($2::text[]) AS c(candidate)
            WHERE regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') LIKE c.candidate || '%'
               OR c.candidate LIKE regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') || '%'
         )
      ORDER BY
        CASE
          WHEN lower(name) = ANY($1::text[]) THEN 0
          WHEN regexp_replace(lower(name), '[^a-z0-9]+', ' ', 'g') = ANY($2::text[]) THEN 1
          ELSE 2
        END,
        length(name) ASC
      LIMIT 1
    `,
    [candidates.rawCandidates, candidates.normalizedCandidates]
  );

  if (result.rows[0]?.id) {
    return String(result.rows[0].id);
  }

  // Fallback: create missing university records so scraper-origin sources are not dropped.
  return ensureUniversityExists(sourceUniversityName);
};

const createRun = async (
  mode: ScraperIngestionMode,
  payload: ScraperIngestBatchRequestDTO
): Promise<string> => {
  const result = await query(
    `
      INSERT INTO scraper_ingestion_runs (
        mode,
        status,
        source_system,
        requested_by,
        university_scope,
        fetched_count,
        metadata
      )
      VALUES ($1, 'running', 'AdmissionTimes-Scrapers', $2, $3, $4, $5)
      RETURNING id
    `,
    [
      mode,
      payload.requested_by || 'internal-service',
      payload.university_scope || null,
      payload.records.length,
      JSON.stringify({ force_publish: !!payload.force_publish }),
    ]
  );

  return String(result.rows[0].id);
};

const logEvent = async (
  runId: string,
  status: ScraperEventStatus,
  record: ScrapedAdmissionIngestDTO,
  sourceHash: string,
  options?: {
    canonicalAdmissionId?: string | null;
    reason?: string;
    errorDetail?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> => {
  await query(
    `
      INSERT INTO scraper_ingestion_events (
        run_id,
        source_record_hash,
        source_university_name,
        source_program_title,
        source_last_date,
        source_details_link,
        event_status,
        canonical_admission_id,
        reason,
        error_detail,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `,
    [
      runId,
      sourceHash,
      normalizeText(record.source_university_name),
      normalizeText(record.source_program_title),
      normalizeText(record.source_last_date),
      normalizeText(record.source_details_link),
      status,
      options?.canonicalAdmissionId || null,
      options?.reason || null,
      options?.errorDetail || null,
      options?.metadata ? JSON.stringify(options.metadata) : null,
    ]
  );
};

const publishRecord = async (
  runId: string,
  record: ScrapedAdmissionIngestDTO,
  sourceHash: string
): Promise<{ admissionId: string; status: 'inserted' | 'updated' | 'skipped'; reason?: string }> => {
  const parsedDeadline = toIsoDateOrNull(record.source_last_date);
  if (!parsedDeadline) {
    return { admissionId: '', status: 'skipped', reason: 'Record skipped because source_last_date is invalid or missing' };
  }

  const universityId = await resolveUniversityId(record.source_university_name);
  if (!universityId) {
    return {
      admissionId: '',
      status: 'skipped',
      reason: `Record skipped because source university could not be mapped: ${normalizeText(record.source_university_name)}`,
    };
  }

  const title = normalizeText(record.source_program_title);
  const sourceUrl = normalizeText(record.source_details_link) || null;
  const degreeLevel = inferDegreeLevelFromTitle(title);

  const universityResult = await query(
    `
      SELECT name, city, country
      FROM universities
      WHERE id = $1
      LIMIT 1
    `,
    [universityId]
  );

  const universityName = normalizeText(universityResult.rows[0]?.name || record.source_university_name);
  const location = [normalizeText(universityResult.rows[0]?.city), normalizeText(universityResult.rows[0]?.country)]
    .filter(Boolean)
    .join(', ') || null;
  const fallbackDescription = buildFallbackDescription(title, universityName, degreeLevel, location);

  const result = await query(
    `
      INSERT INTO admissions (
        university_id,
        title,
        description,
        degree_level,
        location,
        deadline,
        verification_status,
        is_active,
        data_origin,
        source_system,
        source_url,
        source_record_hash,
        source_last_seen_at,
        ingestion_run_id,
        requirements
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        'pending',
        true,
        'scraper',
        'AdmissionTimes-Scrapers',
        NOW(),
        $6,
        $7
      )
      ON CONFLICT (source_record_hash)
      DO UPDATE SET
        university_id = COALESCE(admissions.university_id, EXCLUDED.university_id),
        title = EXCLUDED.title,
        description = COALESCE(NULLIF(admissions.description, ''), EXCLUDED.description),
        degree_level = COALESCE(NULLIF(admissions.degree_level, ''), EXCLUDED.degree_level),
        location = COALESCE(NULLIF(admissions.location, ''), EXCLUDED.location),
        deadline = EXCLUDED.deadline,
        source_url = EXCLUDED.source_url,
        source_last_seen_at = NOW(),
        ingestion_run_id = EXCLUDED.ingestion_run_id,
        requirements = COALESCE(admissions.requirements, '{}'::jsonb) || EXCLUDED.requirements,
        verification_status = CASE
          WHEN admissions.verification_status = 'verified'
            AND (
              admissions.title IS DISTINCT FROM EXCLUDED.title
              OR admissions.deadline IS DISTINCT FROM EXCLUDED.deadline
              OR COALESCE(admissions.source_url, '') IS DISTINCT FROM COALESCE(EXCLUDED.source_url, '')
            )
          THEN 'pending'::verification_status
          ELSE admissions.verification_status
        END,
        needs_reverification = CASE
          WHEN admissions.verification_status = 'verified'
            AND (
              admissions.title IS DISTINCT FROM EXCLUDED.title
              OR admissions.deadline IS DISTINCT FROM EXCLUDED.deadline
              OR COALESCE(admissions.source_url, '') IS DISTINCT FROM COALESCE(EXCLUDED.source_url, '')
            )
          THEN true
          ELSE admissions.needs_reverification
        END,
        updated_at = NOW()
      RETURNING id::text AS id, (xmax = 0) AS inserted
    `,
    [
      universityId,
      title,
      fallbackDescription,
      degreeLevel,
      location,
      parsedDeadline,
      sourceUrl,
      sourceHash,
      runId,
      JSON.stringify({
        source_university_name: normalizeText(record.source_university_name),
        source_program_title: normalizeText(record.source_program_title),
        source_publish_date: normalizeText(record.source_publish_date || ''),
        source_last_date: normalizeText(record.source_last_date),
        source_details_link: normalizeText(record.source_details_link),
        programs_offered: Array.isArray(record.programs_offered) ? record.programs_offered : [],
        programs_offered_count: Array.isArray(record.programs_offered) ? record.programs_offered.length : 0,
        scraping_metadata: record.scraping_metadata || null,
      }),
    ]
  );

  const row = result.rows[0];
  const admissionId = String(row.id);
  const inserted = !!row.inserted;

  await query(
    `
      INSERT INTO changelogs (
        admission_id,
        actor_type,
        changed_by,
        action_type,
        field_name,
        old_value,
        new_value,
        diff_summary,
        metadata
      )
      VALUES ($1, 'system', NULL, $2, 'deadline', NULL, $3, $4, $5)
    `,
    [
      admissionId,
      inserted ? 'created' : 'updated',
      JSON.stringify({ title, deadline: parsedDeadline, source_url: sourceUrl }),
      inserted
        ? 'Scraper publish created canonical admission in pending verification state'
        : 'Scraper publish updated canonical admission fields',
      JSON.stringify({
        run_id: runId,
        source_record_hash: sourceHash,
        source_system: 'AdmissionTimes-Scrapers',
      }),
    ]
  );

  return { admissionId, status: inserted ? 'inserted' : 'updated' };
};

export const ingestBatch = async (
  payload: ScraperIngestBatchRequestDTO
): Promise<ScraperIngestionSummary> => {
  if (!config.scraperIntegration.enabled) {
    throw new AppError('Scraper integration is disabled', 503);
  }

  if (!payload.records || payload.records.length === 0) {
    throw new AppError('records array is required', 400);
  }

  const canPublish = config.scraperIntegration.publishEnabled || !!payload.force_publish;
  const mode: ScraperIngestionMode = canPublish ? 'publish' : 'mirror';
  const runId = await createRun(mode, payload);

  let mirroredCount = 0;
  let publishedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const record of payload.records) {
    const sourceHash = computeSourceHash(record);

    try {
      if (mode === 'mirror') {
        mirroredCount += 1;
        await logEvent(runId, 'mirrored', record, sourceHash, {
          reason: 'Mirror mode active; publish disabled',
          metadata: { publish_enabled: false },
        });
        continue;
      }

      const published = await publishRecord(runId, record, sourceHash);
      if (published.status === 'skipped') {
        skippedCount += 1;
        await logEvent(runId, 'skipped', record, sourceHash, {
          reason: published.reason || 'Record skipped by publish rules',
        });
        continue;
      }

      publishedCount += 1;
      if (published.status === 'updated') {
        updatedCount += 1;
      }

      await logEvent(runId, published.status, record, sourceHash, {
        canonicalAdmissionId: published.admissionId,
      });
    } catch (error: any) {
      failedCount += 1;
      await logEvent(runId, 'failed', record, sourceHash, {
        reason: 'Failed to process ingestion record',
        errorDetail: String(error?.message || error),
      });
    }
  }

  const finalStatus: 'completed' | 'failed' | 'partial' =
    failedCount === 0 ? 'completed' : failedCount === payload.records.length ? 'failed' : 'partial';

  await query(
    `
      UPDATE scraper_ingestion_runs
      SET
        status = $2,
        completed_at = NOW(),
        mirrored_count = $3,
        published_count = $4,
        updated_count = $5,
        skipped_count = $6,
        failed_count = $7,
        updated_at = NOW()
      WHERE id = $1
    `,
    [runId, finalStatus, mirroredCount, publishedCount, updatedCount, skippedCount, failedCount]
  );

  return {
    run_id: runId,
    mode,
    fetched_count: payload.records.length,
    mirrored_count: mirroredCount,
    published_count: publishedCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
    status: finalStatus,
  };
};

const mapRunStatusLabel = (row: any): ScraperRunListItem['status_label'] => {
  if (row.status === 'running') return 'Running';
  if (row.status === 'failed' || Number(row.failed_count || 0) > 0) return 'Failed';
  if (Number(row.updated_count || 0) + Number(row.published_count || 0) > 0) return 'Changes Detected';
  if (row.status === 'completed') return 'No Changes';
  return 'No Changes';
};

const mapRunRow = (row: any): ScraperRunListItem => {
  return {
    id: String(row.id),
    job_id: String(row.id),
    university: row.university || 'All Sources',
    started_at: String(row.started_at),
    finished_at: row.completed_at ? String(row.completed_at) : null,
    status: row.status,
    status_label: mapRunStatusLabel(row),
    source_url: row.source_url || null,
    duration_seconds: parseInt(row.duration_seconds || 0, 10),
    scheduler_triggered: row.requested_by !== 'internal-service',
    changes_detected: parseInt(row.changes_detected || 0, 10),
    fetched_count: parseInt(row.fetched_count || 0, 10),
    mirrored_count: parseInt(row.mirrored_count || 0, 10),
    published_count: parseInt(row.published_count || 0, 10),
    updated_count: parseInt(row.updated_count || 0, 10),
    skipped_count: parseInt(row.skipped_count || 0, 10),
    failed_count: parseInt(row.failed_count || 0, 10),
  };
};

export const getScraperRunSummary = async (): Promise<ScraperRunSummary> => {
  const result = await query(
    `
      SELECT
        COUNT(*)::int AS total_jobs,
        COUNT(*) FILTER (
          WHERE status = 'completed' AND COALESCE(failed_count, 0) = 0
        )::int AS successful_jobs,
        COUNT(*) FILTER (
          WHERE status IN ('failed', 'partial') OR COALESCE(failed_count, 0) > 0
        )::int AS failed_jobs,
        COUNT(*) FILTER (
          WHERE status = 'running'
        )::int AS running_jobs,
        MAX(started_at)::text AS last_execution
      FROM scraper_ingestion_runs
    `,
    []
  );

  const row = result.rows[0] || {};
  return {
    total_jobs: parseInt(row.total_jobs || 0, 10),
    successful_jobs: parseInt(row.successful_jobs || 0, 10),
    failed_jobs: parseInt(row.failed_jobs || 0, 10),
    running_jobs: parseInt(row.running_jobs || 0, 10),
    last_execution: row.last_execution || null,
  };
};

export const getScraperRuns = async (
  page: number,
  limit: number,
  status?: string,
  mode?: string
): Promise<{ runs: ScraperRunListItem[]; total: number }> => {
  const offset = (page - 1) * limit;
  const where: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (status) {
    where.push(`r.status = $${idx++}`);
    params.push(status);
  }
  if (mode) {
    where.push(`r.mode = $${idx++}`);
    params.push(mode);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const listSql = `
    SELECT
      r.id::text,
      COALESCE(NULLIF(r.university_scope, ''), 'All Sources') AS university,
      r.status,
      r.mode,
      r.requested_by,
      r.started_at::text,
      r.completed_at::text,
      r.fetched_count,
      r.mirrored_count,
      r.published_count,
      r.updated_count,
      r.skipped_count,
      r.failed_count,
      COALESCE(r.updated_count, 0) + COALESCE(r.published_count, 0) AS changes_detected,
      GREATEST(
        0,
        EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.started_at))::int
      ) AS duration_seconds,
      ev.source_details_link AS source_url
    FROM scraper_ingestion_runs r
    LEFT JOIN LATERAL (
      SELECT e.source_details_link
      FROM scraper_ingestion_events e
      WHERE e.run_id = r.id
        AND e.source_details_link IS NOT NULL
        AND e.source_details_link <> ''
      ORDER BY e.created_at DESC
      LIMIT 1
    ) ev ON TRUE
    ${whereClause}
    ORDER BY r.started_at DESC
    LIMIT $${idx++} OFFSET $${idx}
  `;
  params.push(limit, offset);

  const countSql = `
    SELECT COUNT(*)::int AS count
    FROM scraper_ingestion_runs r
    ${whereClause}
  `;

  const [listResult, countResult] = await Promise.all([
    query(listSql, params),
    query(countSql, params.slice(0, params.length - 2)),
  ]);

  return {
    runs: listResult.rows.map(mapRunRow),
    total: parseInt(countResult.rows[0]?.count || 0, 10),
  };
};

export const getScraperRunDetail = async (runId: string): Promise<ScraperRunDetail> => {
  const runResult = await query(
    `
      SELECT
        r.id::text,
        COALESCE(NULLIF(r.university_scope, ''), 'All Sources') AS university,
        r.status,
        r.mode,
        r.requested_by,
        r.started_at::text,
        r.completed_at::text,
        r.fetched_count,
        r.mirrored_count,
        r.published_count,
        r.updated_count,
        r.skipped_count,
        r.failed_count,
        COALESCE(r.updated_count, 0) + COALESCE(r.published_count, 0) AS changes_detected,
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (COALESCE(r.completed_at, NOW()) - r.started_at))::int
        ) AS duration_seconds,
        ev.source_details_link AS source_url
      FROM scraper_ingestion_runs r
      LEFT JOIN LATERAL (
        SELECT e.source_details_link
        FROM scraper_ingestion_events e
        WHERE e.run_id = r.id
          AND e.source_details_link IS NOT NULL
          AND e.source_details_link <> ''
        ORDER BY e.created_at DESC
        LIMIT 1
      ) ev ON TRUE
      WHERE r.id = $1
      LIMIT 1
    `,
    [runId]
  );

  if (!runResult.rows[0]) {
    throw new AppError('Scraper ingestion run not found', 404);
  }

  const eventsResult = await query(
    `
      SELECT
        id::text,
        event_status,
        source_university_name,
        source_program_title,
        source_last_date,
        source_details_link,
        reason,
        error_detail,
        created_at::text
      FROM scraper_ingestion_events
      WHERE run_id = $1
      ORDER BY created_at DESC
      LIMIT 200
    `,
    [runId]
  );

  const events: ScraperRunEventItem[] = eventsResult.rows.map((row: any) => ({
    id: String(row.id),
    event_status: row.event_status,
    source_university_name: row.source_university_name || null,
    source_program_title: row.source_program_title || null,
    source_last_date: row.source_last_date || null,
    source_details_link: row.source_details_link || null,
    reason: row.reason || null,
    error_detail: row.error_detail || null,
    created_at: String(row.created_at),
  }));

  const [breakdownResult, skipReasonsResult] = await Promise.all([
    query(
      `
        SELECT
          COALESCE(source_university_name, 'Unknown Source') AS source_university_name,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE event_status = 'inserted')::int AS inserted,
          COUNT(*) FILTER (WHERE event_status = 'updated')::int AS updated,
          COUNT(*) FILTER (WHERE event_status = 'skipped')::int AS skipped,
          COUNT(*) FILTER (WHERE event_status = 'failed')::int AS failed
        FROM scraper_ingestion_events
        WHERE run_id = $1
        GROUP BY 1
        ORDER BY total DESC, source_university_name ASC
      `,
      [runId]
    ),
    query(
      `
        SELECT
          COALESCE(source_university_name, 'Unknown Source') AS source_university_name,
          COALESCE(reason, 'No reason provided') AS reason,
          COUNT(*)::int AS count
        FROM scraper_ingestion_events
        WHERE run_id = $1
          AND event_status = 'skipped'
        GROUP BY 1, 2
        ORDER BY count DESC, source_university_name ASC, reason ASC
      `,
      [runId]
    ),
  ]);

  const universityBreakdown: ScraperRunUniversityBreakdownItem[] = breakdownResult.rows.map((row: any) => ({
    source_university_name: String(row.source_university_name || 'Unknown Source'),
    total: parseInt(row.total || 0, 10),
    inserted: parseInt(row.inserted || 0, 10),
    updated: parseInt(row.updated || 0, 10),
    skipped: parseInt(row.skipped || 0, 10),
    failed: parseInt(row.failed || 0, 10),
  }));

  const skipReasons: ScraperRunSkipReasonItem[] = skipReasonsResult.rows.map((row: any) => ({
    source_university_name: String(row.source_university_name || 'Unknown Source'),
    reason: String(row.reason || 'No reason provided'),
    count: parseInt(row.count || 0, 10),
  }));

  return {
    run: mapRunRow(runResult.rows[0]),
    events,
    university_breakdown: universityBreakdown,
    skip_reasons: skipReasons,
  };
};

const replayRecordsFromRun = async (runId: string): Promise<{ universityScope: string | null; records: ScrapedAdmissionIngestDTO[] }> => {
  const runResult = await query(
    `
      SELECT id::text, university_scope
      FROM scraper_ingestion_runs
      WHERE id = $1
      LIMIT 1
    `,
    [runId]
  );

  const run = runResult.rows[0];
  if (!run) {
    throw new AppError('Scraper ingestion run not found', 404);
  }

  const eventsResult = await query(
    `
      SELECT DISTINCT ON (source_record_hash)
        source_university_name,
        source_program_title,
        source_last_date,
        source_details_link,
        source_record_hash
      FROM scraper_ingestion_events
      WHERE run_id = $1
        AND COALESCE(source_university_name, '') <> ''
        AND COALESCE(source_program_title, '') <> ''
        AND COALESCE(source_last_date, '') <> ''
      ORDER BY source_record_hash, created_at DESC
    `,
    [runId]
  );

  if (!eventsResult.rows.length) {
    throw new AppError('No replayable scraper records were found for this run', 400);
  }

  const records: ScrapedAdmissionIngestDTO[] = eventsResult.rows.map((row: any) => ({
    source_university_name: normalizeText(row.source_university_name),
    source_program_title: normalizeText(row.source_program_title),
    source_last_date: normalizeText(row.source_last_date),
    source_details_link: normalizeText(row.source_details_link),
  }));

  return {
    universityScope: run.university_scope || null,
    records,
  };
};

const replayRecordsFromLatestEventsAllSources = async (): Promise<{ sourceRunId: string; records: ScrapedAdmissionIngestDTO[] }> => {
  const latestRunResult = await query(
    `
      SELECT id::text
      FROM scraper_ingestion_runs
      ORDER BY started_at DESC
      LIMIT 1
    `,
    []
  );

  const sourceRunId = latestRunResult.rows[0]?.id;
  if (!sourceRunId) {
    throw new AppError('No scraper runs found to replay', 404);
  }

  const eventsResult = await query(
    `
      SELECT DISTINCT ON (source_record_hash)
        source_university_name,
        source_program_title,
        source_last_date,
        source_details_link,
        source_record_hash
      FROM scraper_ingestion_events
      WHERE COALESCE(source_university_name, '') <> ''
        AND COALESCE(source_program_title, '') <> ''
        AND COALESCE(source_last_date, '') <> ''
      ORDER BY source_record_hash, created_at DESC
    `,
    []
  );

  if (!eventsResult.rows.length) {
    throw new AppError('No replayable scraper records were found across scraper sources', 400);
  }

  const records: ScrapedAdmissionIngestDTO[] = eventsResult.rows.map((row: any) => ({
    source_university_name: normalizeText(row.source_university_name),
    source_program_title: normalizeText(row.source_program_title),
    source_last_date: normalizeText(row.source_last_date),
    source_details_link: normalizeText(row.source_details_link),
  }));

  return {
    sourceRunId: String(sourceRunId),
    records,
  };
};

export const triggerManualRunAll = async (
  requestedBy: string,
  forcePublish?: boolean
): Promise<ScraperManualRunResult> => {
  const replay = await replayRecordsFromLatestEventsAllSources();

  const ingestion = await ingestBatch({
    records: replay.records,
    requested_by: requestedBy,
    university_scope: 'all',
    force_publish: !!forcePublish,
  });

  return {
    source_run_id: replay.sourceRunId,
    replayed_records: replay.records.length,
    ingestion,
  };
};

export const triggerManualRerun = async (
  runId: string,
  requestedBy: string,
  forcePublish?: boolean
): Promise<ScraperManualRunResult> => {
  const replay = await replayRecordsFromRun(runId);

  const ingestion = await ingestBatch({
    records: replay.records,
    requested_by: requestedBy,
    university_scope: replay.universityScope || 'all',
    force_publish: !!forcePublish,
  });

  return {
    source_run_id: runId,
    replayed_records: replay.records.length,
    ingestion,
  };
};
