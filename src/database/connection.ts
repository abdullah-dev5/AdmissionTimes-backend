/**
 * Database connection module
 *
 * PostgreSQL pool management, query helper and transaction helper.
 */

import { Pool, PoolClient, QueryResult, PoolConfig } from 'pg';
import dns from 'dns';
import { config } from '../config/config';
import { createLogger } from '../shared/utils/logger';

const log = createLogger('DB');

// Prefer IPv4 (avoids IPv6 resolution failures on some Windows/hosted networks).
dns.setDefaultResultOrder('ipv4first');

let pool: Pool | null = null;

const SLOW_QUERY_MS = 1000;

const buildSslConfig = (): PoolConfig['ssl'] => {
  const host = config.database.host;
  const isHostedSupabase = host.includes('supabase.co') || host.includes('pooler.supabase.com');
  if (!isHostedSupabase && !config.database.sslCa) return false;

  if (config.database.sslCa) {
    return { ca: config.database.sslCa, rejectUnauthorized: true };
  }

  // Encrypted but unverified. Configure DB_SSL_CA (Supabase root certificate)
  // and DB_SSL_REJECT_UNAUTHORIZED=true to verify the server certificate.
  return { rejectUnauthorized: config.database.sslRejectUnauthorized };
};

/**
 * Initialize the connection pool. Safe to call more than once.
 */
export const initializePool = (): void => {
  if (pool) return;

  pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: config.database.poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: buildSslConfig(),
  });

  pool.on('error', (err: Error) => {
    log.error('Unexpected error on idle client', err.message);
  });

  log.debug(`Pool configured for ${config.database.host}:${config.database.port}/${config.database.name}`);
};

export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() first.');
  }
  return pool;
};

/**
 * Check connectivity. Returns false instead of throwing.
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    await getPool().query('SELECT 1');
    return true;
  } catch (error) {
    log.error('Connection test failed', (error as Error)?.message);
    return false;
  }
};

/**
 * Execute a parameterized query. Parameters are never logged (they may hold
 * personal data); failures log the error code and a SQL prefix only.
 */
export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const start = Date.now();
  try {
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_MS) {
      log.warn(`Slow query (${duration}ms): ${text.replace(/\s+/g, ' ').slice(0, 120)}`);
    }
    return result;
  } catch (error: any) {
    log.error(`Query failed after ${Date.now() - start}ms`, {
      code: error?.code,
      message: error?.message,
      sql: text.replace(/\s+/g, ' ').slice(0, 160),
    });
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => getPool().connect();

/**
 * Run `work` inside a transaction; commits on success, rolls back on error.
 */
export const withTransaction = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    log.info('Pool closed');
  }
};

export const isPoolInitialized = (): boolean => pool !== null;
