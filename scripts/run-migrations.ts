import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

dotenv.config();

interface MigrationFile {
  fileName: string;
  absolutePath: string;
}

const ROOT = process.cwd();
const MIGRATION_DIRS = [
  path.join(ROOT, 'migrations'),
  path.join(ROOT, 'supabase', 'migrations'),
];

const getDbClient = () => {
  const ssl = process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false };

  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
  });
};

const listMigrationFiles = (): MigrationFile[] => {
  const files: MigrationFile[] = [];

  for (const dir of MIGRATION_DIRS) {
    if (!fs.existsSync(dir)) {
      continue;
    }

    const sqlFiles = fs
      .readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const fileName of sqlFiles) {
      files.push({
        fileName,
        absolutePath: path.join(dir, fileName),
      });
    }
  }

  // Keep deterministic order and avoid accidental duplicates by file name
  const dedup = new Map<string, MigrationFile>();
  for (const file of files.sort((a, b) => a.fileName.localeCompare(b.fileName))) {
    if (!dedup.has(file.fileName)) {
      dedup.set(file.fileName, file);
    }
  }

  return Array.from(dedup.values());
};

const isAlreadyAppliedError = (error: any): boolean => {
  const code = error?.code as string | undefined;
  const message = String(error?.message || '').toLowerCase();

  const duplicateCodes = new Set(['42P07', '42701', '42710', '42P06']);
  if (code && duplicateCodes.has(code)) {
    return true;
  }

  return message.includes('already exists') || message.includes('duplicate');
};

const detectMigrationColumn = async (client: Client): Promise<'migration_name' | 'file_name'> => {
  const existsResult = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'schema_migrations'
    ) AS exists
  `);

  if (!existsResult.rows[0]?.exists) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    return 'migration_name';
  }

  const colsResult = await client.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
  `);

  const cols = new Set(colsResult.rows.map((row) => row.column_name));
  if (cols.has('migration_name')) {
    return 'migration_name';
  }
  if (cols.has('file_name')) {
    return 'file_name';
  }

  throw new Error('Unsupported schema_migrations table shape: missing migration_name/file_name column');
};

const run = async () => {
  const migrations = listMigrationFiles();

  if (!migrations.length) {
    console.log('No migration files found.');
    return;
  }

  const client = getDbClient();
  await client.connect();

  try {
    const migrationColumn = await detectMigrationColumn(client);

    const appliedRows = await client.query<{ migration_name?: string; file_name?: string }>(
      `SELECT ${migrationColumn} FROM schema_migrations`
    );
    const applied = new Set(
      appliedRows.rows
        .map((r) => (migrationColumn === 'migration_name' ? r.migration_name : r.file_name))
        .filter((name): name is string => !!name)
    );

    let appliedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      if (applied.has(migration.fileName)) {
        skippedCount += 1;
        console.log(`⏭️  Skipping already applied: ${migration.fileName}`);
        continue;
      }

      const sql = fs.readFileSync(migration.absolutePath, 'utf8');
      console.log(`▶️  Applying: ${migration.fileName}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (${migrationColumn}) VALUES ($1)`, [migration.fileName]);
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`✅ Applied: ${migration.fileName}`);
      } catch (error) {
        await client.query('ROLLBACK');

        if (isAlreadyAppliedError(error)) {
          await client.query(
            `INSERT INTO schema_migrations (${migrationColumn}) VALUES ($1) ON CONFLICT (${migrationColumn}) DO NOTHING`,
            [migration.fileName]
          );
          appliedCount += 1;
          console.log(`⚠️  Marked as applied (already exists): ${migration.fileName}`);
          continue;
        }

        throw error;
      }
    }

    console.log(`\nDone. Applied: ${appliedCount}, Skipped: ${skippedCount}, Total: ${migrations.length}`);
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Migration run failed:', error?.message || error);
  process.exit(1);
});
