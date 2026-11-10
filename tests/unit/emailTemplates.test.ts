import { emailTemplates, escapeHtml } from '../../src/shared/email/emailTemplates';
import { toAbsoluteAppUrl } from '../../src/domain/notifications/services/emailDelivery';
import { config } from '../../src/config/config';

describe('email templates', () => {
  const reminder = {
    user_name: 'Ali',
    program_name: 'BS <script>alert(1)</script>',
    university_name: 'Aror University',
    deadline_date: '9 March 2027',
    days_left: '3 days',
  };

  it('escapes values written by users', () => {
    const { html } = emailTemplates.deadlineReminder(reminder);
    expect(html).not.toContain('<script>');
    expect(html).toContain(escapeHtml('<script>alert(1)</script>'));
  });

  it('shows the real deadline and time left', () => {
    const { html, text } = emailTemplates.deadlineReminder(reminder);
    expect(html).toContain('9 March 2027');
    expect(text).toContain('Time left: 3 days');
  });

  it('omits the button when there is no absolute link (never a fake URL)', () => {
    const { html, text } = emailTemplates.deadlineReminder(reminder);
    expect(html).not.toContain('href=');
    expect(html).not.toContain('admissiontimes.local');
    expect(text).not.toContain('View program');
  });

  it('includes http(s) links and refuses other schemes', () => {
    expect(emailTemplates.notification('T', 'B', 'View', 'https://app.test/program/1').html).toContain('href="https://app.test/program/1"');
    expect(emailTemplates.notification('T', 'B', 'View', 'javascript:alert(1)').html).not.toContain('javascript:');
  });
});

describe('toAbsoluteAppUrl', () => {
  const original = config.webAppUrl;
  afterEach(() => {
    (config as { webAppUrl: string }).webAppUrl = original;
  });

  it('joins app paths with WEB_APP_URL', () => {
    (config as { webAppUrl: string }).webAppUrl = 'https://app.test';
    expect(toAbsoluteAppUrl('/program/abc')).toBe('https://app.test/program/abc');
    expect(toAbsoluteAppUrl('https://other.test/x')).toBe('https://other.test/x');
  });

  it('returns nothing without WEB_APP_URL, so no broken link is sent', () => {
    (config as { webAppUrl: string }).webAppUrl = '';
    expect(toAbsoluteAppUrl('/program/abc')).toBeUndefined();
    expect(toAbsoluteAppUrl(null)).toBeUndefined();
  });
});
