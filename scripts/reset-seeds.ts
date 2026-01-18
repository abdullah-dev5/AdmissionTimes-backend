/**
 * Reset Seeds Script
 * 
 * Clears seed tracking and optionally clears data from tables,
 * then re-runs all seeds.
 * 
 * Usage:
 *   pnpm reset-seeds              - Clear seed tracking only (keeps data)
 *   pnpm reset-seeds --clear-data  - Clear seed tracking AND all seeded data
 */

import { initializePool, testConnection, getPool } from '../src/database/connection';
import { clearAllSeedTracking, clearSeedTracking } from '../supabase/seeds/typescript/utils';
import { query } from '../src/database/connection';
import { SeedResult } from '../supabase/seeds/typescript/types';

/**
 * Clear all seeded data from tables (in reverse dependency order)
 */
async function clearAllSeededData(): Promise<void> {
  console.log('\n🗑️  Clearing all seeded data from tables...\n');
  
  // Tables in reverse dependency order (children first, then parents)
  const tables = [
    'user_preferences',
    'watchlists',
    'analytics_events',
    'user_activity',
    'notifications',
    'changelogs',
    'deadlines',
    'admissions',
    'users',
  ];
  
  for (const table of tables) {
    try {
      const result = await query(`DELETE FROM ${table}`);
      const count = result.rowCount || 0;
      console.log(`   ✅ Cleared ${count} records from ${table}`);
    } catch (error: any) {
      // Table might not exist or have foreign key constraints
      if (error.code === '42P01') {
        console.log(`   ⏭️  Table ${table} does not exist, skipping`);
      } else {
        console.log(`   ⚠️  Error clearing ${table}: ${error.message}`);
      }
    }
  }
  
  console.log('\n✅ All seeded data cleared\n');
}

/**
 * Clear seed tracking for specific seeds
 */
async function clearSeedTrackingForSeeds(seedNames: string[]): Promise<void> {
  console.log('\n🗑️  Clearing seed tracking...\n');
  
  for (const seedName of seedNames) {
    try {
      await clearSeedTracking(seedName);
      console.log(`   ✅ Cleared tracking for: ${seedName}`);
    } catch (error: any) {
      console.log(`   ⚠️  Error clearing tracking for ${seedName}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Seed tracking cleared\n');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const clearData = args.includes('--clear-data') || args.includes('-c');
  const specificSeeds = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
  
  console.log('\n🔄 Seed Reset Script\n');
  console.log(`Mode: ${clearData ? 'Clear Data + Reset Tracking' : 'Reset Tracking Only'}`);
  if (specificSeeds.length > 0) {
    console.log(`Target Seeds: ${specificSeeds.join(', ')}`);
  } else {
    console.log('Target Seeds: All seeds');
  }
  
  try {
    // Initialize database connection
    initializePool();
    
    // Test connection
    console.log('\n🔌 Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed. Please check your .env file.');
    }
    console.log('✅ Database connection successful');
    
    // Clear data if requested
    if (clearData) {
      await clearAllSeededData();
    }
    
    // Clear seed tracking
    if (specificSeeds.length > 0) {
      // Clear tracking for specific seeds
      await clearSeedTrackingForSeeds(specificSeeds);
    } else {
      // Clear all seed tracking
      console.log('\n🗑️  Clearing all seed tracking...');
      await clearAllSeedTracking();
      console.log('✅ All seed tracking cleared\n');
    }
    
    // Re-run seeds by importing and calling the seed functions directly
    console.log('🌱 Re-running seeds...\n');
    
    // Import seed functions
    const { seedUsers } = await import('../supabase/seeds/typescript/users.seed');
    const { seedAdmissions } = await import('../supabase/seeds/typescript/admissions.seed');
    const { seedDeadlines } = await import('../supabase/seeds/typescript/deadlines.seed');
    const { seedChangelogs } = await import('../supabase/seeds/typescript/changelogs.seed');
    const { seedNotifications } = await import('../supabase/seeds/typescript/notifications.seed');
    const { seedUserActivity } = await import('../supabase/seeds/typescript/user-activity.seed');
    const { seedAnalyticsEvents } = await import('../supabase/seeds/typescript/analytics-events.seed');
    const { seedWatchlists } = await import('../supabase/seeds/typescript/watchlists.seed');
    const { seedUserPreferences } = await import('../supabase/seeds/typescript/user-preferences.seed');
    const { markSeedExecuted } = await import('../supabase/seeds/typescript/utils');
    
    // Run seeds in order
    const seedConfig = [
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
    
    const results: SeedResult[] = [];
    for (const config of seedConfig) {
      // Skip if specific seeds requested and this isn't one of them
      if (specificSeeds.length > 0 && !specificSeeds.includes(config.name)) {
        continue;
      }
      
      console.log(`\n📄 Running seed: ${config.name}`);
      const startTime = Date.now();
      try {
        const result = await config.fn();
        const executionTime = Date.now() - startTime;
        
        if (result.success) {
          await markSeedExecuted(config.name, result.recordCount);
          console.log(`   ✅ Seed completed: ${config.name} (${result.recordCount || 0} records, ${executionTime}ms)`);
          results.push({ 
            seedName: config.name, 
            success: true, 
            recordCount: result.recordCount || 0, 
            executionTime 
          });
        } else {
          console.error(`   ❌ Seed failed: ${config.name}`);
          results.push({ 
            seedName: config.name, 
            success: false, 
            error: result.error,
            executionTime 
          });
        }
      } catch (error: any) {
        const executionTime = Date.now() - startTime;
        console.error(`   ❌ Seed failed: ${config.name}`);
        console.error(`   Error: ${error.message}`);
        results.push({ 
          seedName: config.name, 
          success: false, 
          error: error.message,
          executionTime 
        });
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Seeding Summary:');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    console.log(`   ✅ Successful: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);
    console.log(`   📄 Total: ${results.length}`);
    if (successful.length > 0) {
      const totalRecords = successful.reduce((sum, r) => sum + (r.recordCount || 0), 0);
      const totalTime = successful.reduce((sum, r) => sum + (r.executionTime || 0), 0);
      console.log(`   📊 Total records seeded: ${totalRecords}`);
      console.log(`   ⏱️  Total time: ${totalTime}ms`);
    }
    console.log('='.repeat(60));
    
    // Close connection pool
    const pool = getPool();
    await pool.end();
    
    console.log('\n✅ Seed reset completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Seed reset failed:');
    console.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { main as resetSeeds };
