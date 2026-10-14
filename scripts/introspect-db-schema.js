/**
 * One-off schema introspection for Supabase/Postgres.
 * Usage: node scripts/introspect-db-schema.js
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const host = process.env.DB_HOST || 'localhost';
const requiresSSL =
  process.env.DB_SSL !== 'false' &&
  (host.includes('supabase.co') || host.includes('pooler.supabase.com'));

const pool = new Pool({
  host,
  port: parseInt(process.env.DB_PORT || '54322', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: requiresSSL ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const tablesRes = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const colsRes = await pool.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const enumsRes = await pool.query(`
    SELECT t.typname AS enum_name, e.enumlabel AS enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);

  const byTable = {};
  for (const row of colsRes.rows) {
    if (!byTable[row.table_name]) byTable[row.table_name] = [];
    byTable[row.table_name].push(row);
  }

  const lines = ['# Live database schema (public)', '', `Generated: ${new Date().toISOString()}`, ''];
  lines.push('## Tables', '');
  for (const t of tablesRes.rows) {
    lines.push(`- ${t.table_name}`);
  }

  lines.push('', '## Columns by table', '');
  for (const tableName of Object.keys(byTable).sort()) {
    lines.push(`### ${tableName}`, '');
    lines.push('| Column | Type | UDT | Nullable | Default |');
    lines.push('|--------|------|-----|----------|---------|');
    for (const c of byTable[tableName]) {
      const def = c.column_default ? String(c.column_default).replace(/\|/g, '\\|').slice(0, 40) : '';
      lines.push(`| ${c.column_name} | ${c.data_type} | ${c.udt_name} | ${c.is_nullable} | ${def} |`);
    }
    lines.push('');
  }

  lines.push('## Enums', '');
  const enumMap = {};
  for (const row of enumsRes.rows) {
    if (!enumMap[row.enum_name]) enumMap[row.enum_name] = [];
    enumMap[row.enum_name].push(row.enum_value);
  }
  for (const [name, values] of Object.entries(enumMap).sort()) {
    lines.push(`- **${name}**: ${values.join(', ')}`);
  }

  const outPath = path.join(__dirname, '..', 'audit-reports', 'DB-LIVE-SCHEMA.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote', outPath);
  console.log('Tables:', tablesRes.rows.length);
  await pool.end();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
