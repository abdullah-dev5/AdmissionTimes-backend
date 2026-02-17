// Rollback and re-run migration
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function rollbackAndRerun() {
  try {
    console.log('🔄 Rolling back migration...');
    
    const rollbackSQL = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/rollback_20260211000001.sql'),
      'utf-8'
    );
    
    // Execute rollback
    const { error: rollbackError } = await supabase.rpc('exec_sql', { sql: rollbackSQL });
    if (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
      return;
    }
    
    console.log('✅ Rollback successful');
    console.log('🔄 Re-running migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20260211000001_auto_status_transitions.sql'),
      'utf-8'
    );
    
    // Execute migration
    const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    if (migrationError) {
      console.error('❌ Migration failed:', migrationError);
      return;
    }
    
    console.log('✅ Migration successful');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

rollbackAndRerun();
