/**
 * Authorization regression suite.
 *
 * Builds the full app (auth middleware + routes) with a mocked database and
 * real signed JWTs, and asserts that every privilege-escalation path stays
 * closed. Role/university always come from the users table, never the token.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-only-secret';
const ISSUER = 'https://test-project.supabase.co/auth/v1';

const UNI_A = '11111111-1111-4111-8111-111111111111';
const UNI_B = '22222222-2222-4222-8222-222222222222';
const ADMISSION_OF_B = '33333333-3333-4333-8333-333333333333';

type UserRow = { id: string; role: string; university_id: string | null; status: string; email: string };

const USERS: Record<string, UserRow> = {
  'auth-student': { id: 'aaaaaaaa-0000-4000-8000-000000000001', role: 'student', university_id: null, status: 'active', email: 's@test.local' },
  'auth-uni-a': { id: 'aaaaaaaa-0000-4000-8000-000000000002', role: 'university', university_id: UNI_A, status: 'active', email: 'u@test.local' },
  'auth-suspended': { id: 'aaaaaaaa-0000-4000-8000-000000000003', role: 'student', university_id: null, status: 'suspended', email: 'x@test.local' },
  'auth-admin': { id: 'aaaaaaaa-0000-4000-8000-000000000004', role: 'admin', university_id: null, status: 'active', email: 'a@test.local' },
};

const token = (sub: string, extra: Record<string, unknown> = {}, secret = JWT_SECRET) =>
  jwt.sign({ sub, email: `${sub}@test.local`, aud: 'authenticated', ...extra }, secret, {
    algorithm: 'HS256',
    issuer: ISSUER,
    expiresIn: '5m',
  });

const routeQuery = (sql: string, params: unknown[] = []) => {
  if (sql.includes('FROM users WHERE auth_user_id = $1')) {
    const user = USERS[String(params[0])];
    return { rows: user ? [user] : [] };
  }
  if (sql.includes('FROM admissions a') && sql.includes('WHERE a.id = $1')) {
    return params[0] === ADMISSION_OF_B
      ? { rows: [{ id: ADMISSION_OF_B, university_id: UNI_B, title: 'BS CS', verification_status: 'verified', deadline: null }] }
      : { rows: [] };
  }
  if (sql.includes('COUNT(*)')) return { rows: [{ count: 0 }] };
  return { rows: [] };
};

describe('Authorization rules', () => {
  let app: any;

  beforeAll(async () => {
    process.env.SUPABASE_JWT_SECRET = JWT_SECRET;
    process.env.JWT_ISSUER = ISSUER;
    process.env.ALLOW_DEV_HEADER_AUTH = 'false';

    jest.resetModules();
    jest.doMock('@db/connection', () => {
      const query = jest.fn(async (sql: string, params?: unknown[]) => routeQuery(sql, params));
      return {
        query,
        withTransaction: async (work: (db: any) => Promise<unknown>) => work({ query }),
        testConnection: async () => true,
        initializePool: () => undefined,
        getClient: async () => ({ query, release: () => undefined }),
      };
    });

    const { createApp } = await import('../../src/app');
    app = createApp();
  });

  const as = (sub: string) => ({ Authorization: `Bearer ${token(sub)}` });

  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/v1/admissions');
    expect(res.status).toBe(401);
  });

  it('rejects tokens signed with the wrong key', async () => {
    const res = await request(app)
      .get('/api/v1/admissions')
      .set('Authorization', `Bearer ${token('auth-student', {}, 'attacker-secret')}`);
    expect(res.status).toBe(401);
  });

  it('ignores the role claimed in user_metadata (database role wins)', async () => {
    const forged = token('auth-student', { user_metadata: { role: 'admin', university_id: UNI_B } });
    const res = await request(app).get('/api/v1/admin/admissions').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(403);
  });

  it('ignores x-user-role / x-user-id headers', async () => {
    const res = await request(app)
      .get('/api/v1/admin/admissions')
      .set('x-user-id', USERS['auth-admin'].id)
      .set('x-user-role', 'admin');
    expect(res.status).toBe(401);
  });

  it('blocks suspended accounts', async () => {
    const res = await request(app).get('/api/v1/admissions').set(as('auth-suspended'));
    expect(res.status).toBe(403);
  });

  it('forbids students from creating admissions', async () => {
    const res = await request(app).post('/api/v1/admissions').set(as('auth-student')).send({ title: 'Fake program' });
    expect(res.status).toBe(403);
  });

  it('rejects client-supplied verified status', async () => {
    const res = await request(app)
      .post('/api/v1/university/admissions')
      .set(as('auth-uni-a'))
      .send({ title: 'BS AI', verification_status: 'verified' });
    expect(res.status).toBe(400);
  });

  it("hides another university's admission from a university rep", async () => {
    const res = await request(app)
      .put(`/api/v1/admissions/${ADMISSION_OF_B}`)
      .set(as('auth-uni-a'))
      .send({ title: 'Hijacked title' });
    expect(res.status).toBe(404);
  });

  it('forbids non-admins from verifying admissions', async () => {
    const res = await request(app).patch(`/api/v1/admissions/${ADMISSION_OF_B}/verify`).set(as('auth-uni-a')).send({});
    expect(res.status).toBe(403);
  });

  it('forbids students from broadcasting or creating notifications', async () => {
    const broadcast = await request(app)
      .post('/api/v1/notifications/broadcast')
      .set(as('auth-student'))
      .send({ target_type: 'all', title: 'Hello', message: 'Phishing' });
    const create = await request(app)
      .post('/api/v1/notifications')
      .set(as('auth-student'))
      .send({ recipient_id: USERS['auth-admin'].id, title: 'x', message: 'y' });
    expect(broadcast.status).toBe(403);
    expect(create.status).toBe(403);
  });

  it('forbids students from deleting deadlines', async () => {
    const res = await request(app).delete(`/api/v1/deadlines/${ADMISSION_OF_B}`).set(as('auth-student'));
    expect(res.status).toBe(403);
  });

  it('forbids students from reading system analytics', async () => {
    const res = await request(app).get('/api/v1/analytics/stats').set(as('auth-student'));
    expect(res.status).toBe(403);
  });

  it('forbids students from listing users', async () => {
    const res = await request(app).get('/api/v1/users').set(as('auth-student'));
    expect(res.status).toBe(403);
  });

  it('only allows student self-registration', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({
      email: 'evil@test.local',
      user_type: 'admin',
      auth_user_id: '44444444-4444-4444-8444-444444444444',
    });
    expect(res.status).toBe(400);
  });

  it('lets an admin through to admin routes', async () => {
    const res = await request(app).get('/api/v1/admin/admissions').set(as('auth-admin'));
    expect(res.status).toBe(200);
  });
});
