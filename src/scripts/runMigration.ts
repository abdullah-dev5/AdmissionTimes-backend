/**
 * Database migration runner
 * Run with: npx ts-node -r tsconfig-paths/register src/scripts/runMigration.ts
 */

import { query, initializePool, closePool } from '@db/connection';

async function runMigration() {
  try {
    console.log('🔌 Initializing database connection...');
    initializePool();
    
    console.log('🚀 Running migration: Admin Module Schema');
    
    // MIGRATION 1: Add Admin Fields to Admissions Table
    console.log('\n📝 Step 1: Adding admin fields to admissions table...');
    
    const alterColumns = [
      'ALTER TABLE admissions ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL',
      'ALTER TABLE admissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL',
      'ALTER TABLE admissions ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL',
      'ALTER TABLE admissions ADD COLUMN IF NOT EXISTS verification_comments TEXT DEFAULT NULL'
    ];
    
    for (const sql of alterColumns) {
      try {
        await query(sql);
        console.log('  ✅ Column added');
      } catch (error: any) {
        if (error.code === '42701') {
          console.log('  ℹ️  Column already exists, skipping');
        } else {
          throw error;
        }
      }
    }
    
    // Add indexes
    console.log('\n📝 Step 2: Creating indexes on admissions table...');
    
    await query('CREATE INDEX IF NOT EXISTS idx_admissions_verified_by ON admissions(verified_by)');
    console.log('  ✅ Index on verified_by created');
    
    await query('CREATE INDEX IF NOT EXISTS idx_admissions_status_verified_at ON admissions(verification_status, verified_at DESC)');
    console.log('  ✅ Index on verification_status + verified_at created');
    
    // MIGRATION 2: Create Admin Audit Logs Table
    console.log('\n📝 Step 3: Creating admin_audit_logs table...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
          'verify', 'reject', 'update_notes', 'bulk_verify'
        )),
        entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
          'admission', 'user', 'university', 'settings'
        )),
        entity_id UUID NOT NULL,
        old_values JSONB DEFAULT NULL,
        new_values JSONB DEFAULT NULL,
        reason TEXT DEFAULT NULL,
        ip_address INET DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by VARCHAR(255) DEFAULT 'system'
      )
    `);
    console.log('  ✅ admin_audit_logs table created');
    
    // Create indexes for admin_audit_logs
    console.log('\n📝 Step 4: Creating indexes on admin_audit_logs table...');
    
    await query('CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id)');
    console.log('  ✅ Index on admin_id created');
    
    await query('CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC)');
    console.log('  ✅ Index on created_at created');
    
    await query('CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON admin_audit_logs(entity_type, entity_id)');
    console.log('  ✅ Index on entity_type + entity_id created');
    
    await query('CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action_type)');
    console.log('  ✅ Index on action_type created');
    
    console.log('\n✅ Migration completed successfully!');
    
    // Verify
    console.log('\n🔍 Verification:');
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'admin_audit_logs'
    `);
    
    if (result.rows.length > 0) {
      console.log('  ✅ admin_audit_logs table exists');
      
      const columns = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'admin_audit_logs'
        ORDER BY ordinal_position
      `);
      
      console.log(`  📊 Table has ${columns.rows.length} columns`);
    }
    
    const admissionCols = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admissions' 
      AND column_name IN ('verified_by', 'rejection_reason', 'admin_notes', 'verification_comments')
    `);
    
    console.log(`  ✅ admissions table has ${admissionCols.rows.length}/4 new admin columns`);
    
    await closePool();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`   PostgreSQL Error Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }
    process.exit(1);
  }
}

runMigration();
