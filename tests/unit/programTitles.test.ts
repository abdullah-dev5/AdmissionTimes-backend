import { cleanProgramTitle, expandToProgramRecords } from '../../src/domain/scraper-integration/services/programTitles';

describe('scraped program titles', () => {
  it.each([
    // FAST
    ['Bachelor of Science (Computer Science)', 'BS Computer Science'],
    ['Bachelor of Science (Accounting and Finance)', 'BS Accounting and Finance'],
    ['Bachelor of Business Administration', 'BBA'],
    // IBA Karachi
    ['BBA (Bachelor of Business Administration)', 'BBA'],
    ['BSACF (BS Accounting & Finance)', 'BS Accounting & Finance'],
    ['BS (Computer Science / Mathematics)', 'BS Computer Science / Mathematics'],
    ['BSEM (BS Econometrics & Mathematical Economics)', 'BS Econometrics & Mathematical Economics'],
    // NUTECH
    ['BS Artificial Intelligence (BS AI)', 'BS Artificial Intelligence'],
    ['BS Computer Engineering (BS CEN)', 'BS Computer Engineering'],
    // IBA Sukkur
    ['BS Computer Science Specialization in Artificial Intelligence (AI)', 'BS Computer Science Specialization in Artificial Intelligence'],
    ['BE Electrical Engineering Specialization in Power', 'BE Electrical Engineering Specialization in Power'],
    // MAJU (already clean)
    ['BS FinTech', 'BS FinTech'],
    ['Bachelor of Engineering in Civil Engineering', 'BE Civil Engineering'],
    ['Master of Science (Data Science)', 'MS Data Science'],
  ])('%s -> %s', (raw, expected) => {
    expect(cleanProgramTitle(raw)).toBe(expected);
  });

  it('rejects cut-off titles', () => {
    expect(cleanProgramTitle('BE Specialization in')).toBeNull();
    expect(cleanProgramTitle('B.Ed BS Accounting & Finance')).toBeNull();
    expect(cleanProgramTitle('B.Ed')).toBe('B.Ed');
    expect(cleanProgramTitle('BS Computer Science and')).toBeNull();
    expect(cleanProgramTitle('  ')).toBeNull();
  });

  it('prefixes bare field names with the announcement degree', () => {
    expect(cleanProgramTitle('Computer Science', 'BS')).toBe('BS Computer Science');
    expect(cleanProgramTitle('BBA', 'BS')).toBe('BBA');
  });

  it('splits an announcement into one record per program (GIKI)', () => {
    const records = expandToProgramRecords({
      source_university_name: 'GIKI',
      source_program_title: 'Admissions 2025 Undergraduate Programs',
      source_last_date: '2026-06-05',
      source_details_link: 'https://giki.edu.pk/admissions',
      programs_offered: ['Artificial Intelligence', 'Computer Science', 'Computer Science', 'Data Science'],
    });
    expect(records.map((r) => r.source_program_title)).toEqual(['BS Artificial Intelligence', 'BS Computer Science', 'BS Data Science']);
    expect(records.every((r) => r.source_last_date === '2026-06-05' && r.source_details_link === 'https://giki.edu.pk/admissions')).toBe(true);
    expect(records[0].scraping_metadata?.announcement_title).toBe('Admissions 2025 Undergraduate Programs');
    expect(records[0].programs_offered).toEqual([]);
  });

  it('keeps an announcement without a program list as one record', () => {
    const records = expandToProgramRecords({
      source_university_name: 'NUTECH',
      source_program_title: 'Spring 2026 Undergraduate Admissions',
      source_last_date: '2026-09-19',
      source_details_link: '',
      programs_offered: [],
    });
    expect(records).toHaveLength(1);
    expect(records[0].source_program_title).toBe('Spring 2026 Undergraduate Admissions');
  });
});
