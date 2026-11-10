/**
 * One-off: bring existing scraped admissions to "one admission per program".
 *
 * New scraper runs already split announcements and normalize titles
 * (scraper-integration/services/programTitles.ts). Rows created before that
 * are a mix of announcement rows and per-program rows with raw titles. This:
 *   1. splits each active announcement row (one with a program list) into one
 *      admission per program (same deadline, link and verification status),
 *      then deactivates the announcement row;
 *   2. deactivates announcement rows without a program list when the
 *      university already has program rows;
 *   3. renames program rows to the normalized title (and its identity hash),
 *      deactivating duplicates and titles that are not a program name;
 *   4. fills degree_level from the title where it is empty;
 *   5. gives two universities their proper display names.
 * Every change writes a changelog entry (actor: system).
 *
 * Usage (dry run by default):
 *   npx ts-node -r tsconfig-paths/register scripts/normalize-scraped-admissions.ts [--apply]
 */

import { initializePool, query, withTransaction } from '@db/connection';
import { syncApplicationDeadline } from '@domain/admissions/models/admissions.model';
import { inferDegreeLabel } from '@shared/utils/admissionContract';
import { computeIdentityHash } from '@domain/scraper-integration/services/scraper-integration.service';
import { announcementDegree, cleanProgramTitle } from '@domain/scraper-integration/services/programTitles';

const APPLY = process.argv.includes('--apply');

/** Display names; the new names still resolve through the scraper alias table. */
const UNIVERSITY_RENAMES: Array<[string, string]> = [
  ['Fast University', 'FAST-NUCES'],
  ['National University of Technology (NUTECH), Islamabad', 'National University of Technology (NUTECH)'],
];

type Row = {
  id: string;
  university_id: string;
  university: string;
  title: string;
  degree_level: string | null;
  verification_status: string;
  deadline: string | null;
  source_url: string | null;
  requirements: Record<string, any> | null;
  watchers: number;
};

const isAnnouncementTitle = (title: string) => /\b(admissions?|programs)\b/i.test(title) && !/^(BS|BBA|BE|MS|MBA|B\.?Ed)\b/i.test(title);

const log = (message: string) => console.log(`${APPLY ? '' : '[dry-run] '}${message}`);

const changelog = (db: any, admissionId: string, action: string, field: string | null, oldValue: unknown, newValue: unknown, summary: string) =>
  db.query(
    `INSERT INTO changelogs (admission_id, actor_type, changed_by, action_type, field_name, old_value, new_value, diff_summary, metadata)
     VALUES ($1, 'system', NULL, $2, $3, $4, $5, $6, $7)`,
    [
      admissionId,
      action,
      field,
      oldValue === null || oldValue === undefined ? null : JSON.stringify(oldValue),
      newValue === null || newValue === undefined ? null : JSON.stringify(newValue),
      summary,
      JSON.stringify({ source: 'normalize-scraped-admissions' }),
    ]
  );

const deactivate = async (db: any, row: Row, reason: string) => {
  log(`  deactivate "${row.title}" (${row.university}; ${row.watchers} watcher(s)): ${reason}`);
  if (!APPLY) return;
  await db.query(`UPDATE admissions SET is_active = false, updated_at = NOW() WHERE id = $1`, [row.id]);
  await changelog(db, row.id, 'updated', 'is_active', true, false, reason);
};

async function main() {
  initializePool();
  const stats = { split: 0, created: 0, renamed: 0, deactivated: 0, degree: 0, universities: 0 };

  await withTransaction(async (db) => {
    for (const [from, to] of UNIVERSITY_RENAMES) {
      const result = await db.query(`SELECT id FROM universities WHERE name = $1`, [from]);
      if (!result.rows.length) continue;
      log(`university "${from}" -> "${to}"`);
      stats.universities += 1;
      if (APPLY) await db.query(`UPDATE universities SET name = $2, updated_at = NOW() WHERE name = $1`, [from, to]);
    }

    const rows: Row[] = (
      await db.query(
        `SELECT a.id::text, a.university_id::text, u.name AS university, a.title, a.degree_level,
                a.verification_status::text, a.deadline, a.source_url, a.requirements,
                (SELECT COUNT(*)::int FROM watchlists w WHERE w.admission_id = a.id) AS watchers
         FROM admissions a JOIN universities u ON u.id = a.university_id
         WHERE a.is_active AND a.data_origin = 'scraper'
         ORDER BY u.name, a.title`
      )
    ).rows;

    // Identities that will exist after this run, per university.
    const taken = new Map<string, string>(); // identity hash -> admission id
    for (const row of rows) {
      if (isAnnouncementTitle(row.title)) continue;
      const clean = cleanProgramTitle(row.title);
      if (clean) {
        const identity = computeIdentityHash(row.university_id, clean);
        if (!taken.has(identity)) taken.set(identity, row.id);
      }
    }
    const programRowsByUniversity = new Map<string, number>();
    for (const row of rows) {
      if (!isAnnouncementTitle(row.title)) programRowsByUniversity.set(row.university_id, (programRowsByUniversity.get(row.university_id) || 0) + 1);
    }

    for (const row of rows) {
      // 1-2. Announcement rows
      if (isAnnouncementTitle(row.title)) {
        const degree = announcementDegree(row.title);
        const programs = Array.from(
          new Set(((row.requirements?.programs_offered as string[]) || []).map((p) => cleanProgramTitle(p, degree)).filter(Boolean) as string[])
        );
        if (!programs.length) {
          if (programRowsByUniversity.get(row.university_id)) {
            await deactivate(db, row, 'Announcement without a program list; the university has program listings');
            stats.deactivated += 1;
          } else {
            log(`  keep "${row.title}" (${row.university}): no program list and no program rows`);
          }
          continue;
        }

        log(`split "${row.title}" (${row.university}) into ${programs.length} program(s)`);
        stats.split += 1;
        for (const program of programs) {
          const identity = computeIdentityHash(row.university_id, program);
          if (taken.has(identity)) {
            log(`  exists: ${program}`);
            continue;
          }
          taken.set(identity, 'new');
          stats.created += 1;
          log(`  create: ${program} (${row.verification_status})`);
          if (!APPLY) continue;
          const inserted = await db.query(
            `INSERT INTO admissions (
               university_id, title, degree_level, deadline, verification_status, verified_by, verified_at,
               is_active, data_origin, source_system, source_url, source_record_hash, source_last_seen_at, requirements
             )
             SELECT a.university_id, $2, $3, a.deadline, a.verification_status, a.verified_by, a.verified_at,
                    true, 'scraper', a.source_system, a.source_url, $4, a.source_last_seen_at,
                    COALESCE(a.requirements, '{}'::jsonb) || jsonb_build_object('programs_offered', '[]'::jsonb, 'announcement_title', a.title)
             FROM admissions a WHERE a.id = $1
             RETURNING id::text AS id`,
            [row.id, program, inferDegreeLabel(program), identity]
          );
          const newId = inserted.rows[0].id;
          await syncApplicationDeadline(db, newId, row.deadline);
          await changelog(db, newId, 'created', null, null, { title: program }, `Split from announcement "${row.title}"`);
        }
        await deactivate(db, row, 'Replaced by one listing per program');
        stats.deactivated += 1;
        continue;
      }

      // 3. Program rows
      const clean = cleanProgramTitle(row.title);
      if (!clean) {
        await deactivate(db, row, 'Not a complete program name (scraper artifact)');
        stats.deactivated += 1;
        continue;
      }
      const identity = computeIdentityHash(row.university_id, clean);
      if (taken.get(identity) !== row.id) {
        await deactivate(db, row, `Duplicate of "${clean}"`);
        stats.deactivated += 1;
        continue;
      }
      if (clean !== row.title) {
        log(`rename "${row.title}" -> "${clean}" (${row.university})`);
        stats.renamed += 1;
        if (APPLY) {
          await db.query(`UPDATE admissions SET title = $2, source_record_hash = $3, updated_at = NOW() WHERE id = $1`, [row.id, clean, identity]);
          await changelog(db, row.id, 'updated', 'title', row.title, clean, 'Title normalized');
        }
      } else if (APPLY) {
        await db.query(`UPDATE admissions SET source_record_hash = $2 WHERE id = $1`, [row.id, identity]);
      }

      // 4. Degree level
      const degree = inferDegreeLabel(clean);
      if (!row.degree_level?.trim() && degree) {
        stats.degree += 1;
        if (APPLY) await db.query(`UPDATE admissions SET degree_level = $2 WHERE id = $1`, [row.id, degree]);
      }
    }

    if (!APPLY) throw new DryRun();
  }).catch((error) => {
    if (!(error instanceof DryRun)) throw error;
  });

  console.log('\nSummary:', stats, APPLY ? '(applied)' : '(dry run: nothing written; use --apply)');
  process.exit(0);
}

class DryRun extends Error {}

main().catch((error) => {
  console.error('FAILED', error);
  process.exit(1);
});
