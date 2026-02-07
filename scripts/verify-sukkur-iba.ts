/**
 * Verify Sukkur IBA Admissions
 * 
 * Queries the database to verify the seeded admission records
 */

import { initializePool, getPool, query } from '@db/connection';

async function verifySeededData() {
  await initializePool();
  
  try {
    const result = await query(
      'SELECT id, title, verification_status FROM admissions WHERE university_id = $1 ORDER BY created_at DESC LIMIT 10',
      ['975a3939-986a-4824-9528-6d7265739cac']
    );
    
    console.log(`Found ${result.rows.length} admissions for Sukkur IBA`);
    result.rows.forEach((row, i) => {
      console.log(`${i+1}. ${row.title.substring(0, 50)} - ${row.verification_status}`);
    });
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await getPool().end();
  }
}

verifySeededData();
