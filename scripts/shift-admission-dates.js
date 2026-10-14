/**
 * Shift admission dates forward so demo/test data has upcoming deadlines.
 *
 * Every active admission deadline (and start_date) moves by the same number of
 * days, preserving the real relative order. The `deadlines` table is then
 * re-synced to admissions.deadline with reminder bookkeeping reset, so the
 * reminder scheduler treats the new dates as fresh.
 *
 * Usage:
 *   node scripts/shift-admission-dates.js --days 160            (dry run: preview only)
 *   node scripts/shift-admission-dates.js --days 160 --apply    (writes, in one transaction)
 *
 * Note: the next real scraper run replaces scraped deadlines with the values
 * published on university websites.
 */

require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const args = process.argv.slice(2);
const daysArg = args[args.indexOf('--days') + 1];
const days = Number(daysArg);
const apply = args.includes('--apply');

if (!args.includes('--days') || !Number.isInteger(days) || days === 0 || Math.abs(days) > 730) {
  console.error('Usage: node scripts/shift-admission-dates.js --days <integer 1..730> [--apply]');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

const summarize = async (client, label) => {
  const { rows } = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE deadline < NOW())                                AS closed,
      COUNT(*) FILTER (WHERE deadline >= NOW() AND deadline < NOW() + INTERVAL '7 days')  AS within_7_days,
      COUNT(*) FILTER (WHERE deadline >= NOW() + INTERVAL '7 days' AND deadline < NOW() + INTERVAL '30 days') AS within_30_days,
      COUNT(*) FILTER (WHERE deadline >= NOW() + INTERVAL '30 days')          AS later,
      MIN(deadline)::date AS earliest,
      MAX(deadline)::date AS latest
    FROM admissions WHERE is_active AND deadline IS NOT NULL`);
  console.log(`\n${label}`);
  console.table(rows);
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await summarize(client, 'Before');

    // Remember updated_by, then shift with updated_by = NULL so the legacy
    // auto-pending trigger (see migration 20261007000000) cannot fire, and
    // restore updated_by in a second statement that changes no content.
    await client.query(`CREATE TEMP TABLE shift_owner ON COMMIT DROP AS
                        SELECT id, updated_by FROM admissions WHERE is_active AND (deadline IS NOT NULL OR start_date IS NOT NULL)`);

    const shifted = await client.query(
      `UPDATE admissions
       SET deadline = deadline + make_interval(days => $1),
           start_date = start_date + $1,
           updated_by = NULL
       WHERE is_active AND (deadline IS NOT NULL OR start_date IS NOT NULL)`,
      [days]
    );
    await client.query(`UPDATE admissions a SET updated_by = s.updated_by FROM shift_owner s WHERE a.id = s.id`);

    // Re-sync reminder rows to the admission deadline and reset reminder state.
    const resynced = await client.query(`
      UPDATE deadlines d
      SET deadline_date = a.deadline, reminder_sent = false,
          reminder_sent_7d_at = NULL, reminder_sent_3d_at = NULL, reminder_sent_1d_at = NULL,
          updated_at = NOW()
      FROM admissions a
      WHERE d.admission_id = a.id AND d.deadline_type = 'application'
        AND a.is_active AND a.deadline IS NOT NULL
        AND d.deadline_date IS DISTINCT FROM a.deadline`);
    const inserted = await client.query(`
      INSERT INTO deadlines (admission_id, deadline_type, deadline_date)
      SELECT a.id, 'application', a.deadline FROM admissions a
      WHERE a.is_active AND a.deadline IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM deadlines d WHERE d.admission_id = a.id AND d.deadline_type = 'application')`);

    await summarize(client, `After shifting by ${days} days`);
    console.log(`admissions shifted: ${shifted.rowCount}, deadline rows re-synced: ${resynced.rowCount}, deadline rows created: ${inserted.rowCount}`);

    if (apply) {
      await client.query('COMMIT');
      console.log('\nAPPLIED.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDry run only — nothing was written. Re-run with --apply to commit.');
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Failed, rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
