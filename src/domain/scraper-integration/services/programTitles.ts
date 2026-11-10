/**
 * Scraped program titles, normalized to one shape.
 *
 * Every university's site lists programs differently ("Bachelor of Science
 * (Computer Science)", "BSACF (BS Accounting & Finance)", "BS AI (BS AI)", or
 * just "Computer Science"). Students see one card per program, so titles are
 * normalized to the short form used by universities' own entries:
 * "BS Computer Science", "BBA", "BE Electrical Engineering".
 *
 * Scraped announcements are split into one record per program here (the
 * scrapers send announcements with a program list).
 */

import type { ScrapedAdmissionIngestDTO } from '../types/scraper-integration.types';

/** Degree prefixes a program title may start with. */
const DEGREE_PREFIX = /^(BS|BSc|BBA|BE|MS|MSc|MBA|MPhil|PhD|LLB|LLM|MBBS|BDS|Pharm-?D|B\.?Ed|M\.?Ed|BFA|MFA|BArch|ADP|AD|Bachelors?|Masters?|Doctor)\b/i;

const LONG_FORMS: Array<[RegExp, string]> = [
  [/^Bachelor(?:'s)? of Business Administration\b/i, 'BBA'],
  [/^Master(?:'s)? of Business Administration\b/i, 'MBA'],
  [/^Bachelor(?:'s)? of Science\b/i, 'BS'],
  [/^Bachelor(?:'s)? of Engineering\b/i, 'BE'],
  [/^Master(?:'s)? of Science\b/i, 'MS'],
  [/^Master(?:'s)? of Philosophy\b/i, 'MPhil'],
  [/^Doctor of Philosophy\b/i, 'PhD'],
];

const collapse = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Words a title cannot end with (a cut-off scrape such as "BE Specialization in"). */
const DANGLING_END = /\b(in|of|and|for|with|the)$|[&/,-]$/i;

/**
 * Normalize one program title; null when it is not a usable program name.
 * `defaultDegree` prefixes bare field names ("Computer Science" in an
 * undergraduate announcement becomes "BS Computer Science").
 */
export const cleanProgramTitle = (raw: string | null | undefined, defaultDegree?: string | null): string | null => {
  let text = collapse(String(raw ?? '').replace(/[–—]/g, '-')).replace(/[.;:]+$/, '');
  if (!text) return null;

  // "BSACF (BS Accounting & Finance)" / "BBA (Bachelor of Business Administration)": the
  // parenthesis holds the readable name when the outside is only a code.
  const codeWithName = /^([A-Z]{2,8})\s*\((.+)\)$/.exec(text);
  if (codeWithName && DEGREE_PREFIX.test(codeWithName[2].trim())) text = codeWithName[2].trim();

  // Long degree names -> short prefix ("Bachelor of Science (X)" / "... in X" -> "BS X").
  for (const [pattern, short] of LONG_FORMS) {
    if (pattern.test(text)) {
      const rest = collapse(text.replace(pattern, '').replace(/^\s*(?:\(|in\b|-)\s*/i, '').replace(/\)\s*$/, ''));
      text = rest ? `${short} ${rest}` : short;
      break;
    }
  }

  // "BS (Computer Science / Mathematics)" -> "BS Computer Science / Mathematics"
  const prefixParen = /^(BS|BE|MS|BBA|MBA|BSc|MSc)\s*\((.+)\)$/i.exec(text);
  if (prefixParen) text = `${prefixParen[1]} ${prefixParen[2].trim()}`;

  // Trailing abbreviation: "BS Artificial Intelligence (BS AI)", "... (AI)"
  text = collapse(text.replace(/\s*\((?:(?:BS|BE|MS|BBA)\s+)?[A-Z][A-Za-z]{0,6}\)$/, ''));

  if (!DEGREE_PREFIX.test(text) && defaultDegree) text = `${defaultDegree} ${text}`;

  if (text.length < 2 || DANGLING_END.test(text)) return null;
  // Two programs merged by a bad extraction ("B.Ed BS Accounting & Finance").
  if (/^(B\.?Ed|BS|BBA|BE|MS|MBA)\s+(BS|BBA|BE|MS|MBA|B\.?Ed)\b/i.test(text)) return null;
  return text;
};

/** Degree to prefix bare field names with, from the announcement title. */
export const announcementDegree = (announcementTitle: string): string | null => {
  const title = announcementTitle.toLowerCase();
  if (/\b(undergraduate|bachelor|bs\b)/.test(title)) return 'BS';
  if (/\b(graduate|postgraduate|master|ms\b)/.test(title)) return 'MS';
  return null;
};

/**
 * One ingest record per program. An announcement with a program list becomes
 * one record per (normalized, de-duplicated) program sharing its deadline and
 * link; the announcement title is kept in scraping_metadata. A record without
 * a usable list keeps its own (normalized) title.
 */
export const expandToProgramRecords = (record: ScrapedAdmissionIngestDTO): ScrapedAdmissionIngestDTO[] => {
  const announcement = collapse(record.source_program_title || '');
  const degree = announcementDegree(announcement);
  const programs = Array.from(
    new Map(
      (record.programs_offered || [])
        .map((program) => cleanProgramTitle(program, degree))
        .filter((program): program is string => Boolean(program))
        .map((program) => [program.toLowerCase(), program] as [string, string])
    ).values()
  );

  const metadata = {
    ...(record.scraping_metadata || {}),
    announcement_title: announcement || null,
    // Read by the ingest: an announcement without programs is not published as a program.
    program_list_missing: programs.length === 0,
  };

  if (programs.length === 0) {
    return [{ ...record, source_program_title: cleanProgramTitle(announcement) || announcement, scraping_metadata: metadata }];
  }

  return programs.map((program) => ({
    ...record,
    source_program_title: program,
    programs_offered: [],
    scraping_metadata: metadata,
  }));
};
