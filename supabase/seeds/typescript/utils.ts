/**
 * Seeding Utilities
 * 
 * Helper functions for database seeding operations.
 */

import { query, getPool } from '../../../src/database/connection';

/**
 * Check if a seed has already been executed
 */
export async function isSeedExecuted(seedName: string): Promise<boolean> {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM seed_tracking WHERE seed_name = $1',
      [seedName]
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    // If table doesn't exist, assume seed not run
    return false;
  }
}

/**
 * Mark a seed as executed
 */
export async function markSeedExecuted(
  seedName: string,
  recordCount?: number,
  metadata?: Record<string, any>
): Promise<void> {
  await query(
    `INSERT INTO seed_tracking (seed_name, record_count, metadata)
     VALUES ($1, $2, $3)
     ON CONFLICT (seed_name) DO UPDATE
     SET executed_at = CURRENT_TIMESTAMP,
         record_count = EXCLUDED.record_count,
         metadata = EXCLUDED.metadata`,
    [seedName, recordCount || null, metadata ? JSON.stringify(metadata) : null]
  );
}

/**
 * Clear seed tracking for a specific seed (allows re-seeding)
 */
export async function clearSeedTracking(seedName: string): Promise<void> {
  await query('DELETE FROM seed_tracking WHERE seed_name = $1', [seedName]);
}

/**
 * Clear all seed tracking
 */
export async function clearAllSeedTracking(): Promise<void> {
  await query('DELETE FROM seed_tracking');
}

/**
 * Get all executed seeds
 */
export async function getExecutedSeeds(): Promise<string[]> {
  try {
    const result = await query('SELECT seed_name FROM seed_tracking ORDER BY executed_at');
    return result.rows.map(row => row.seed_name);
  } catch (error) {
    return [];
  }
}

/**
 * Execute a query in a transaction
 */
export async function executeInTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate a random UUID (for testing purposes)
 * Note: In production, use database gen_random_uuid()
 */
export function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get random element from array
 */
export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get random elements from array
 */
export function randomElements<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Generate random date between two dates
 */
export function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
