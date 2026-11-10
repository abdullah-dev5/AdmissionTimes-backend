/**
 * Email templates (HTML + plain text).
 *
 * Every interpolated value is HTML-escaped: titles and messages can contain
 * text written by university representatives. Links are optional; when there
 * is no absolute link the button is omitted instead of pointing nowhere.
 */

export interface DeadlineReminderParams {
  user_name: string;
  program_name: string;
  university_name: string;
  deadline_date: string;
  days_left: string;
  portal_url?: string;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/** Only http(s) URLs are allowed in emails. */
const safeUrl = (url?: string): string | undefined => (url && /^https?:\/\//i.test(url) ? url : undefined);

const layout = (title: string, subtitle: string | null, content: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:20px 24px;">
                <h1 style="margin:0;font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;">Admission Times</h1>
                ${subtitle ? `<p style="margin:6px 0 0 0;font-size:13px;line-height:1.5;color:#cbd5e1;">${escapeHtml(subtitle)}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
${content}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">This is an automated message from Admission Times.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const button = (text: string, url?: string): string => {
  const href = safeUrl(url);
  if (!href) return '';
  return `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 8px 0;">
                  <tr>
                    <td style="border-radius:8px;background:#0ea5e9;">
                      <a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 16px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(text)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:12px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  If the button does not work, open this link:<br />
                  <a href="${escapeHtml(href)}" style="color:#0369a1;text-decoration:underline;">${escapeHtml(href)}</a>
                </p>`;
};

export const deadlineReminderHtml = (p: DeadlineReminderParams): string =>
  layout(
    `Deadline reminder: ${p.program_name}`,
    'Deadline Reminder',
    `
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;">Hi ${escapeHtml(p.user_name)},</p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;">
                  The application deadline for <strong>${escapeHtml(p.program_name)}</strong> at
                  <strong>${escapeHtml(p.university_name)}</strong> is on <strong>${escapeHtml(p.deadline_date)}</strong>.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 18px 0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
                  <tr>
                    <td style="padding:12px 14px;">
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#1e3a8a;">Time left: <strong>${escapeHtml(p.days_left)}</strong></p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-size:15px;line-height:1.7;">Please review your application and submit it before the deadline.</p>
                ${button('View program', p.portal_url)}`
  );

export const deadlineReminderText = (p: DeadlineReminderParams): string =>
  [
    `Hi ${p.user_name},`,
    '',
    `The application deadline for ${p.program_name} at ${p.university_name} is on ${p.deadline_date}.`,
    `Time left: ${p.days_left}`,
    '',
    'Please review your application and submit it before the deadline.',
    ...(safeUrl(p.portal_url) ? ['', `View program: ${p.portal_url}`] : []),
    '',
    '— Admission Times',
  ].join('\n');

export const notificationHtml = (title: string, body: string, ctaText?: string, ctaUrl?: string): string =>
  layout(
    title,
    null,
    `
                <h2 style="margin:0 0 14px 0;font-size:18px;color:#1f2937;">${escapeHtml(title)}</h2>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#4b5563;white-space:pre-line;">${escapeHtml(body)}</p>
                ${ctaText ? button(ctaText, ctaUrl) : ''}`
  );

export const notificationText = (title: string, body: string, ctaUrl?: string): string =>
  [title, '', body, ...(safeUrl(ctaUrl) ? ['', `Open: ${ctaUrl}`] : []), '', '— Admission Times'].join('\n');

export const emailTemplates = {
  deadlineReminder: (params: DeadlineReminderParams) => ({
    html: deadlineReminderHtml(params),
    text: deadlineReminderText(params),
  }),
  notification: (title: string, body: string, ctaText?: string, ctaUrl?: string) => ({
    html: notificationHtml(title, body, ctaText, ctaUrl),
    text: notificationText(title, body, ctaUrl),
  }),
};
