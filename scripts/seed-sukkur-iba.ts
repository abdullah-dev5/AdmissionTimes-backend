/**
 * Seed Sukkur IBA Admissions
 * 
 * Executes the seed_sukkur_iba_admissions.sql file to populate
 * 5 admission records for Sukkur IBA University.
 * 
 * Run: pnpm ts-node -r tsconfig-paths/register scripts/seed-sukkur-iba.ts
 */

import { initializePool, getPool } from '@db/connection';
import fs from 'fs';
import path from 'path';

async function seedSukkurIBA() {
  // Initialize database connection pool
  await initializePool();
  
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    console.log('🌱 Starting Sukkur IBA admissions seeding...\n');
    
    // Read SQL file
    const sqlPath = path.join(__dirname, '..', 'supabase', 'seeds', 'seed_sukkur_iba_admissions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute SQL
    await client.query(sql);
    
    console.log('\n✅ Successfully seeded 5 admission records for Sukkur IBA University');
    console.log('   University ID: 975a3939-986a-4824-9528-6d7265739cac');
    console.log('   Created by: 68edbfca-ac83-4b2f-b272-8847c1c9527f');
    
  } catch (error: any) {
    console.error('❌ Error seeding data:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedSukkurIBA();
