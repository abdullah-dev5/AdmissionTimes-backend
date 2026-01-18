/**
 * Database Seeding Runner
 * 
 * Main script to run all database seeds in the correct order.
 * Ensures idempotency and maintains referential integrity.
 * 
 * Usage: pnpm seed
 */

import { initializePool, testConnection, getPool } from '../../../src/database/connection';
import { isSeedExecuted, markSeedExecuted, getExecutedSeeds } from './utils';
import { SeedFunction, SeedResult } from './types';

// Import seed functions
import { seedUsers } from './users.seed';
import { seedAdmissions } from './admissions.seed';
import { seedDeadlines } from './deadlines.seed';
import { seedChangelogs } from './changelogs.seed';
import { seedNotifications } from './notifications.seed';
import { seedUserActivity } from './user-activity.seed';
import { seedAnalyticsEvents } from './analytics-events.seed';
import { seedWatchlists } from './watchlists.seed';
import { seedUserPreferences } from './user-preferences.seed';

/**
 * Seed configuration with dependencies
 */
interface SeedConfigItem {
  name: string;
  fn: SeedFunction;
  dependencies: string[];
}

const SEED_CONFIG: SeedConfigItem[] = [
  { name: 'users', fn: seedUsers, dependencies: [] },
  { name: 'admissions', fn: seedAdmissions, dependencies: [] },
  { name: 'deadlines', fn: seedDeadlines, dependencies: ['admissions'] },
  { name: 'changelogs', fn: seedChangelogs, dependencies: ['admissions'] },
  { name: 'notifications', fn: seedNotifications, dependencies: ['admissions', 'users'] },
  { name: 'user-activity', fn: seedUserActivity, dependencies: ['users', 'admissions'] },
  { name: 'analytics-events', fn: seedAnalyticsEvents, dependencies: ['admissions'] },
  { name: 'watchlists', fn: seedWatchlists, dependencies: ['users', 'admissions'] },
  { name: 'user-preferences', fn: seedUserPreferences, dependencies: ['users'] },
];

/**
 * Run a single seed
 */
async function runSeed(
  seedName: string,
  seedFn: SeedFunction,
  skipIfExists: boolean = true
): Promise<SeedResult> {
  const startTime = Date.now();
  
  // Check if already executed
  if (skipIfExists && (await isSeedExecuted(seedName))) {
    console.log(`⏭️  Skipping (already run): ${seedName}`);
    return {
      seedName,
      success: true,
      recordCount: 0,
      executionTime: 0,
    };
  }
  
  console.log(`\n📄 Running seed: ${seedName}`);
  
  try {
    const result = await seedFn();
    const executionTime = Date.now() - startTime;
    
    if (result.success) {
      // Mark as executed
      await markSeedExecuted(seedName, result.recordCount);
      console.log(`   ✅ Seed completed: ${seedName} (${result.recordCount || 0} records, ${executionTime}ms)`);
    } else {
      console.error(`   ❌ Seed failed: ${seedName}`);
      console.error(`   Error: ${result.error}`);
    }
    
    return {
      ...result,
      seedName,
      executionTime,
    };
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    console.error(`   ❌ Seed failed: ${seedName}`);
    console.error(`   Error: ${error.message}`);
    
    return {
      seedName,
      success: false,
      error: error.message,
      executionTime,
    };
  }
}

/**
 * Check if dependencies are satisfied
 */
async function checkDependencies(seedName: string, dependencies: string[]): Promise<boolean> {
  if (dependencies.length === 0) return true;
  
  const executedSeeds = await getExecutedSeeds();
  const missing = dependencies.filter(dep => !executedSeeds.includes(dep));
  
  if (missing.length > 0) {
    console.error(`   ❌ Missing dependencies for ${seedName}: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Main seeding function
 */
async function main() {
  const args = process.argv.slice(2);
  const seedName = args[0]; // Optional: seed specific table
  
  console.log('🌱 Starting database seeding...\n');
  
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
    
    // Run specific seed or all seeds
    if (seedName) {
      const seedConfig = SEED_CONFIG.find(s => s.name === seedName);
      if (!seedConfig) {
        console.error(`❌ Seed "${seedName}" not found. Available seeds:`);
        SEED_CONFIG.forEach(s => console.log(`   - ${s.name}`));
        process.exit(1);
      }
      
      // Check dependencies
      if (!(await checkDependencies(seedName, seedConfig.dependencies))) {
        process.exit(1);
      }
      
      await runSeed(seedName, seedConfig.fn, false); // Don't skip if running specific seed
    } else {
      // Run all seeds in order
      const results: SeedResult[] = [];
      
      for (const config of SEED_CONFIG) {
        // Check dependencies
        if (!(await checkDependencies(config.name, config.dependencies))) {
          results.push({
            seedName: config.name,
            success: false,
            error: 'Missing dependencies',
          });
          continue;
        }
        
        const result = await runSeed(config.name, config.fn);
        results.push(result);
        
        // Stop on error if critical
        if (!result.success && config.name === 'users') {
          console.error('\n❌ Critical seed failed. Stopping.');
          break;
        }
      }
      
      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('📊 Seeding Summary:');
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      const skipped = results.filter(r => r.success && (r.recordCount === 0));
      
      console.log(`   ✅ Successful: ${successful.length}`);
      console.log(`   ⏭️  Skipped: ${skipped.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);
      console.log(`   📄 Total: ${results.length}`);
      
      if (successful.length > 0) {
        const totalRecords = successful.reduce((sum, r) => sum + (r.recordCount || 0), 0);
        const totalTime = successful.reduce((sum, r) => sum + (r.executionTime || 0), 0);
        console.log(`   📊 Total records seeded: ${totalRecords}`);
        console.log(`   ⏱️  Total time: ${totalTime}ms`);
      }
      
      if (failed.length > 0) {
        console.log('\n❌ Failed seeds:');
        failed.forEach(r => {
          console.log(`   - ${r.seedName}: ${r.error}`);
        });
      }
      
      console.log('='.repeat(60));
      
      if (failed.length > 0) {
        process.exit(1);
      }
    }
    
    // Close connection pool
    const pool = getPool();
    await pool.end();
    
    console.log('\n✅ Seeding completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Seeding process failed:');
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as runSeeds };
