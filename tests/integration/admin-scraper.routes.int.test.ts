import express from 'express';
import request from 'supertest';

describe('Admin scraper endpoints integration (router/service)', () => {
  let query: jest.Mock;

  const makeApp = async () => {
    jest.resetModules();

    jest.doMock('@db/connection', () => ({
      query: jest.fn(),
    }));

    jest.doMock('../../src/domain/admin/middleware/adminOnly', () => ({
      adminOnly: (req: any, _res: any, next: any) => {
        req.user = { id: 'admin-user-1', role: 'admin', email: 'admin@test.local' };
        next();
      },
    }));

    const db = (await import('@db/connection')) as unknown as { query: jest.Mock };
    query = db.query;

    const router = (await import('../../src/domain/admin/routes/admin.routes')).default;
    const { errorHandler } = await import('../../src/shared/middleware/errorHandler');
    const app = express();
    app.use(express.json());
    app.use('/api/v1/admin', router);
    app.use(errorHandler);
    return app;
  };

  beforeEach(() => {
    if (query) query.mockReset();
  });

  it('GET /api/v1/admin/scraper/summary returns summary payload', async () => {
    const app = await makeApp();

    query.mockResolvedValueOnce({
      rows: [
        {
          total_jobs: 4,
          successful_jobs: 3,
          failed_jobs: 1,
          running_jobs: 0,
          last_execution: '2026-04-15T10:00:00.000Z',
        },
      ],
    });

    const res = await request(app).get('/api/v1/admin/scraper/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_jobs).toBe(4);
    expect(res.body.data.failed_jobs).toBe(1);
  });

  it('GET /api/v1/admin/scraper/runs supports status/mode filters with pagination', async () => {
    const app = await makeApp();

    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'run-1',
          university: 'NUST',
          status: 'completed',
          mode: 'publish',
          requested_by: 'admin:admin-user-1',
          started_at: '2026-04-15T09:00:00.000Z',
          completed_at: '2026-04-15T09:01:00.000Z',
          fetched_count: 5,
          mirrored_count: 0,
          published_count: 2,
          updated_count: 1,
          skipped_count: 2,
          failed_count: 0,
          changes_detected: 3,
          duration_seconds: 60,
          source_url: 'https://example.edu/admissions',
        },
      ],
    });

    query.mockResolvedValueOnce({
      rows: [{ count: 1 }],
    });

    const res = await request(app).get('/api/v1/admin/scraper/runs?page=1&limit=20&status=completed&mode=publish');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.data[0].status).toBe('completed');
    expect(res.body.data[0].status_label).toBe('Changes Detected');

    const firstSql = query.mock.calls[0][0] as string;
    const firstParams = query.mock.calls[0][1] as any[];
    expect(firstSql).toContain('WHERE r.status = $1 AND r.mode = $2');
    expect(firstParams[0]).toBe('completed');
    expect(firstParams[1]).toBe('publish');
  });

  it('POST /api/v1/admin/scraper/run-all triggers manual replay using latest records across sources', async () => {
    const app = await makeApp();

    query
      .mockResolvedValueOnce({ rows: [{ id: 'source-run-1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            source_university_name: 'NUST',
            source_program_title: 'MS Data Science',
            source_last_date: '2026-05-01',
            source_details_link: 'https://example.edu/ms-ds',
            source_record_hash: 'hash-1',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'new-run-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/admin/scraper/run-all')
      .send({ force_publish: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.source_run_id).toBe('source-run-1');
    expect(res.body.data.replayed_records).toBe(1);
    expect(res.body.data.ingestion.mode).toBe('mirror');
  });

  it('POST /api/v1/admin/scraper/runs/:id/rerun replays selected run snapshot', async () => {
    const app = await makeApp();

    query
      .mockResolvedValueOnce({ rows: [{ id: 'source-run-2', university_scope: 'FAST' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            source_university_name: 'FAST',
            source_program_title: 'BS CS',
            source_last_date: '2026-06-01',
            source_details_link: 'https://example.edu/bs-cs',
            source_record_hash: 'hash-2',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 'new-run-2' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/v1/admin/scraper/runs/source-run-2/rerun')
      .send({ force_publish: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.source_run_id).toBe('source-run-2');
    expect(res.body.data.ingestion.mode).toBe('mirror');
  });
});
