/**
 * Database connection module
 * 
 * Handles PostgreSQL connection pooling and query execution.
 * Compatible with both Supabase Local and hosted Supabase.
 * 
 * Features:
 * - Connection pool management
 * - Query helper with error handling
 * - Connection testing
 * - Slow query logging (development)
 * - Graceful shutdown handling
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import dns from 'dns';
import { config } from '../config/config';

// Configure DNS to prefer IPv4 (helps with Windows DNS resolution issues)
dns.setDefaultResultOrder('ipv4first');

/**
 * PostgreSQL connection pool instance
 * 
 * The pool manages multiple database connections efficiently,
 * reusing connections and managing concurrent requests.
 */
let pool: Pool | null = null;

/**
 * Initialize the database connection pool
 * 
 * Creates a new connection pool with configuration from environment variables.
 * Should be called once during application startup.
 * 
 * @throws {Error} If database configuration is missing or invalid
 */
export const initializePool = (): void => {
  if (pool) {
    console.warn('⚠️  Database pool already initialized');
    return;
  }

  if (!config.database) {
    throw new Error('Database configuration is missing. Please check your environment variables.');
  }

  // Debug: Log connection details (development only)
  if (config.env === 'development') {
    console.log('🔍 Database connection config:');
    console.log(`   Host: ${config.database.host}`);
    console.log(`   Port: ${config.database.port}`);
    console.log(`   User: ${config.database.user}`);
    console.log(`   Database: ${config.database.name}`);
  }

  // Determine if SSL is required (Supabase Cloud requires SSL)
  // For Supabase Local (localhost), SSL is not required
  // For Supabase Cloud (contains 'supabase.co'), SSL is required
  const requiresSSL = config.database.host.includes('supabase.co') || 
                      config.database.host.includes('pooler.supabase.com');

  pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    max: config.database.poolMax || 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection cannot be established
    // SSL configuration for Supabase Cloud
    ssl: requiresSSL ? {
      rejectUnauthorized: false // Supabase uses self-signed certificates
    } : false,
  });

  // Handle pool errors
  pool.on('error', (err: Error) => {
    console.error('❌ Unexpected error on idle database client:', err);
    // Don't exit the process, let the application handle it
  });

  // Log pool events in development
  if (config.env === 'development') {
    pool.on('connect', () => {
      console.log('✅ New database client connected');
    });

    pool.on('remove', () => {
      console.log('🔌 Database client removed from pool');
    });
  }
};

/**
 * Get the database connection pool
 * 
 * @returns {Pool} The active connection pool
 * @throws {Error} If pool is not initialized
 */
export const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() first.');
  }
  return pool;
};

/**
 * Test the database connection
 * 
 * Executes a simple query to verify the database connection is working.
 * Useful for health checks and startup validation.
 * 
 * @returns {Promise<boolean>} True if connection is successful, false otherwise
 */
export const testConnection = async (): Promise<boolean> => {
  try {
    const testPool = getPool();
    const result = await testPool.query('SELECT NOW() as current_time, version() as pg_version');
    
    if (config.env === 'development') {
      console.log('✅ Database connection successful');
      console.log(`   PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
      console.log(`   Server time: ${result.rows[0].current_time}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

/**
 * Execute a database query
 * 
 * Helper function that executes a parameterized query with error handling.
 * Uses connection pooling for efficient resource management.
 * 
 * @param {string} text - SQL query text (can include $1, $2, etc. for parameters)
 * @param {any[]} params - Query parameters (prevents SQL injection)
 * @returns {Promise<QueryResult>} Query result with rows and metadata
 * @throws {Error} If query execution fails
 * 
 * @example
 * ```typescript
 * const result = await query('SELECT * FROM admissions WHERE id = $1', [admissionId]);
 * const admission = result.rows[0];
 * ```
 */
export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const start = Date.now();
  const dbPool = getPool();

  try {
    const result = await dbPool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries in development
    if (config.env === 'development' && duration > 1000) {
      console.warn(`⚠️  Slow query detected (${duration}ms):`, text.substring(0, 100));
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Query failed after ${duration}ms:`, error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * 
 * Use this when you need to execute multiple queries in a transaction.
 * Remember to release the client when done.
 * 
 * @returns {Promise<PoolClient>} A database client from the pool
 * @throws {Error} If pool is not initialized
 * 
 * @example
 * ```typescript
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO ...');
 *   await client.query('COMMIT');
 * } catch (error) {
 *   await client.query('ROLLBACK');
 *   throw error;
 * } finally {
 *   client.release();
 * }
 * ```
 */
export const getClient = async (): Promise<PoolClient> => {
  const dbPool = getPool();
  return await dbPool.connect();
};

/**
 * Close all database connections gracefully
 * 
 * Should be called during application shutdown to ensure
 * all connections are properly closed.
 * 
 * @returns {Promise<void>}
 */
export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 Database connection pool closed');
  }
};

/**
 * Check if the database pool is initialized
 * 
 * @returns {boolean} True if pool is initialized, false otherwise
 */
export const isPoolInitialized = (): boolean => {
  return pool !== null;
};
