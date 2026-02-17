import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admissions' 
      AND column_name = 'updated_by'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ updated_by column EXISTS');
      console.log('   Type:', result.rows[0].data_type);
    } else {
      console.log('❌ updated_by column NOT FOUND');
    }
    
    // Also check if triggers exist
    const triggers = await pool.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'admissions' 
      AND trigger_name IN ('trigger_auto_pending_on_update', 'trigger_track_admin_verification')
    `);
    
    console.log('\nTriggers found:', triggers.rows.length);
    triggers.rows.forEach((t: any) => console.log('  -', t.trigger_name));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verify();
