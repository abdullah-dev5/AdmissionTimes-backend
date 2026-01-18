/**
 * Migration Runner Script
 * 
 * Runs all database migrations in order on Supabase Cloud.
 * This script reads migration files from supabase/migrations/ and executes them.
 * 
 * Usage: pnpm tsx scripts/run-migrations.ts
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { query, getPool, testConnection } from '../src/database/connection';
import { initializePool } from '../src/database/connection';

/**
 * Get all migration files sorted by filename (chronological order)
 */
async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
  const files = await readdir(migrationsDir);
  
  // Filter only .sql files and sort by filename
  return files
    .filter(file => file.endsWith('.sql'))
    .sort(); // Filenames are timestamped, so sorting alphabetically gives chronological order
}

/**
 * Check if a migration has already been run
 */
async function isMigrationRun(migrationName: string): Promise<boolean> {
  try {
    // Check if migrations table exists
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);
    
    if (!result.rows[0].exists) {
      // Create migrations tracking table
      await query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      return false;
    }
    
    // Check if this migration was already run
    const migrationCheck = await query(
      'SELECT COUNT(*) as count FROM schema_migrations WHERE migration_name = $1',
      [migrationName]
    );
    
    return parseInt(migrationCheck.rows[0].count) > 0;
  } catch (error) {
    // If table doesn't exist or any error, assume migration not run
    return false;
  }
}

/**
 * Mark a migration as executed
 */
async function markMigrationRun(migrationName: string): Promise<void> {
  await query(
    'INSERT INTO schema_migrations (migration_name) VALUES ($1) ON CONFLICT (migration_name) DO NOTHING',
    [migrationName]
  );
}

/**
 * Run a single migration file
 */
async function runMigration(filePath: string, fileName: string): Promise<void> {
  console.log(`\n📄 Running migration: ${fileName}`);
  
  const sql = await readFile(filePath, 'utf-8');
  
  // Remove comments and clean up SQL
  // Execute the entire SQL file as one transaction
  // PostgreSQL can handle multiple statements separated by semicolons
  try {
    // Execute the entire migration file
    await query(sql);
    console.log(`   ✅ Migration executed successfully`);
  } catch (error: any) {
    console.error(`   ❌ Error executing migration:`, error.message);
    // Show the error code and hint if available
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }
    throw error;
  }
  
  // Mark migration as run
  await markMigrationRun(fileName);
  console.log(`   ✅ Migration completed: ${fileName}`);
}

/**
 * Main function to run all migrations
 */
async function main() {
  console.log('🚀 Starting database migrations...\n');
  
  try {
    // Initialize database connection
    initializePool();
    
    // Test connection
    console.log('🔌 Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed. Please check your .env file.');
    }
    console.log('✅ Database connection successful\n');
    
    // Get all migration files
    const migrationFiles = await getMigrationFiles();
    console.log(`📋 Found ${migrationFiles.length} migration files:\n`);
    migrationFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });
    
    // Run each migration
    let successCount = 0;
    let skippedCount = 0;
    
    for (const fileName of migrationFiles) {
      const filePath = join(process.cwd(), 'supabase', 'migrations', fileName);
      
      // Check if already run
      const alreadyRun = await isMigrationRun(fileName);
      if (alreadyRun) {
        console.log(`\n⏭️  Skipping (already run): ${fileName}`);
        skippedCount++;
        continue;
      }
      
      try {
        await runMigration(filePath, fileName);
        successCount++;
      } catch (error: any) {
        console.error(`\n❌ Migration failed: ${fileName}`);
        console.error(`   Error: ${error.message}`);
        throw error;
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log(`   ✅ Successfully run: ${successCount}`);
    console.log(`   ⏭️  Skipped (already run): ${skippedCount}`);
    console.log(`   📄 Total migrations: ${migrationFiles.length}`);
    console.log('='.repeat(60));
    console.log('\n✅ All migrations completed successfully!');
    
    // Close connection pool
    const pool = getPool();
    await pool.end();
    
  } catch (error: any) {
    console.error('\n❌ Migration process failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run migrations
main();
