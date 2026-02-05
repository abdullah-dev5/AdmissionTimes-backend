/**
 * Simple JWT Configuration Check
 */

import * as dotenv from 'dotenv';
dotenv.config();

console.log('🔐 Checking JWT Configuration...\n');

const checks = [
  { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL },
  { name: 'SUPABASE_JWT_SECRET', value: process.env.SUPABASE_JWT_SECRET },
  { name: 'JWT_ISSUER', value: process.env.JWT_ISSUER },
];

checks.forEach(({ name, value }) => {
  const status = value ? '✅' : '❌';
  const display = value ? (value.length > 50 ? value.substring(0, 47) + '...' : value) : '(not set)';
  console.log(`${status} ${name}: ${display}`);
});

console.log('\n📝 Next: Start server with "pnpm dev" and test');
