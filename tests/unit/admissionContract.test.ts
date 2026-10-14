import { withAdmissionContract, calculateDaysRemaining, inferDegreeLabel } from '../../src/shared/utils/admissionContract';

describe('admission response contract', () => {
  const base = { id: 'a1', title: 'BS Computer Science', verification_status: 'verified' };

  it('counts calendar days in Pakistan time (same rule as web and mobile)', () => {
    const now = Date.parse('2026-10-08T05:00:00Z'); // 10:00 PKT
    expect(calculateDaysRemaining('2026-10-12T18:59:59Z', now)).toBe(4);
    expect(calculateDaysRemaining('2026-10-08T18:59:59Z', now)).toBe(0);
    expect(calculateDaysRemaining('2026-10-08T04:00:00Z', now)).toBe(-1);
    expect(calculateDaysRemaining(null, now)).toBe(-1);
  });

  it('never shows an unknown fee as free', () => {
    expect(withAdmissionContract({ ...base, application_fee: null }).fee_display).toBe('Not specified');
    expect(withAdmissionContract({ ...base, application_fee: null }).fee_amount).toBeNull();
    expect(withAdmissionContract({ ...base, application_fee: 0 }).fee_display).toBe('Free');
    expect(withAdmissionContract({ ...base, application_fee: '85000.00' }).fee_display).toBe('PKR 85,000');
  });

  it('marks the data source and exposes the scraped announcement link', () => {
    const scraped = withAdmissionContract({
      ...base,
      data_origin: 'scraper',
      source_url: 'https://giki.edu.pk/admissions',
      requirements: { programs_offered: ['Computer Science', 'Data Science'] },
    });
    expect(scraped.source).toBe('scraper');
    expect(scraped.source_announcement_url).toBe('https://giki.edu.pk/admissions');
    expect(scraped.primary_apply_url).toBe('https://giki.edu.pk/admissions');
    expect(scraped.programs_offered).toEqual(['Computer Science', 'Data Science']);

    const university = withAdmissionContract({ ...base, data_origin: null, source_url: 'https://x.test' });
    expect(university.source).toBe('university');
    expect(university.source_announcement_url).toBeNull();
  });

  it('hides single-program lists that only repeat the title', () => {
    const c = withAdmissionContract({ ...base, requirements: { programs_offered: ['BS Computer Science'] } });
    expect(c.programs_offered).toEqual([]);
  });

  it('derives location from the university when the admission has none', () => {
    const c = withAdmissionContract({ ...base, location: null, university_city: 'Topi', university_country: 'Pakistan' });
    expect(c.location_display).toBe('Topi, Pakistan');
    expect(withAdmissionContract({ ...base }).location_display).toBeNull();
  });

  it('uses the university website from the universities table', () => {
    const c = withAdmissionContract({ ...base, university_website: 'https://aroruniversity.com' });
    expect(c.university_website_url).toBe('https://aroruniversity.com');
  });

  it('infers degree from the title and says "Not specified" otherwise', () => {
    expect(inferDegreeLabel('Bachelor of Science (Data Science)')).toBe('BS');
    expect(inferDegreeLabel('MBA Executive')).toBe('MBA');
    expect(withAdmissionContract({ ...base, title: 'Fall Intake' }).degree_label).toBe('Not specified');
  });

  it('labels only real recommendation matches', () => {
    expect(withAdmissionContract({ ...base, match_score: 50 }).match_label).toBeUndefined();
    expect(withAdmissionContract({ ...base, match_score: 85 }).match_label).toBe('High Match');
  });
});
