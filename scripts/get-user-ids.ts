/**
 * Get User IDs Script
 * 
 * Quick script to get user IDs from the database for testing.
 * Run: pnpm ts-node -r tsconfig-paths/register scripts/get-user-ids.ts
 */

import { initializePool, query, closePool } from '../src/database/connection';

async function getUserIds() {
  try {
    initializePool();
    
    console.log('📋 Fetching user IDs from database...\n');
    
    const result = await query(`
      SELECT 
        id,
        role,
        display_name,
        status
      FROM users
      ORDER BY role, display_name
      LIMIT 20
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users found. Please run: pnpm seed\n');
      return;
    }
    
    console.log('✅ Found users:\n');
    console.log('='.repeat(80));
    
    const students = result.rows.filter(u => u.role === 'student');
    const universities = result.rows.filter(u => u.role === 'university');
    const admins = result.rows.filter(u => u.role === 'admin');
    
    if (students.length > 0) {
      console.log('\n👨‍🎓 STUDENTS:');
      students.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.display_name}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Status: ${user.status}\n`);
      });
    }
    
    if (universities.length > 0) {
      console.log('\n🏛️  UNIVERSITIES:');
      universities.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.display_name}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Status: ${user.status}\n`);
      });
    }
    
    if (admins.length > 0) {
      console.log('\n👨‍💼 ADMINS:');
      admins.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.display_name}`);
        console.log(`     ID: ${user.id}`);
        console.log(`     Status: ${user.status}\n`);
      });
    }
    
    console.log('='.repeat(80));
    console.log('\n💡 Copy these IDs to your Postman environment variables:\n');
    
    if (students.length > 0) {
      console.log(`student_user_id: ${students[0].id}`);
    }
    if (universities.length > 0) {
      console.log(`university_user_id: ${universities[0].id}`);
    }
    if (admins.length > 0) {
      console.log(`admin_user_id: ${admins[0].id}`);
    }
    
    console.log('\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await closePool();
  }
}

getUserIds();
