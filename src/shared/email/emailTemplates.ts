/**
 * Email Templates
 * Reusable HTML and text email templates for notifications
 */

export interface EmailTemplateParams {
  user_name?: string;
  program_name?: string;
  university_name?: string;
  deadline_date?: string;
  days_left?: string | number;
  portal_url?: string;
  [key: string]: any;
}

/**
 * Deadline Reminder Template - HTML version
 */
export const deadlineReminderHtml = (params: EmailTemplateParams): string => {
  const {
    user_name = '[Student Name]',
    program_name = '[Program Name]',
    university_name = '[University Name]',
    deadline_date = '[Deadline Date]',
    days_left = '[Days Left]',
    portal_url = 'https://admissiontimes.local',
  } = params;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Admission Times Reminder</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:#0f172a;padding:20px 24px;">
                <h1 style="margin:0;font-size:20px;line-height:1.3;color:#ffffff;font-weight:700;">Admission Times</h1>
                <p style="margin:6px 0 0 0;font-size:13px;line-height:1.5;color:#cbd5e1;">Deadline Reminder</p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;">
                  Hi ${user_name},
                </p>

                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;">
                  This is a reminder that the application deadline for
                  <strong>${program_name}</strong> at
                  <strong>${university_name}</strong>
                  is on <strong>${deadline_date}</strong>.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0 18px 0;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
                  <tr>
                    <td style="padding:12px 14px;">
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#1e3a8a;">
                        Days left: <strong>${days_left}</strong>
                      </p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;">
                  Please review your application and submit before the deadline.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
                  <tr>
                    <td style="border-radius:8px;background:#0ea5e9;">
                      <a href="${portal_url}" style="display:inline-block;padding:11px 16px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                        Open Admission Portal
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
                  If the button does not work, copy and paste this link into your browser:<br />
                  <a href="${portal_url}" style="color:#0369a1;text-decoration:underline;">${portal_url}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                  This is an automated reminder from Admission Times.
                </p>
              </td>
            </tr>
          </table>

          <p style="margin:12px 0 0 0;font-size:11px;line-height:1.5;color:#94a3b8;">
            © Admission Times
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

/**
 * Deadline Reminder Template - Plain text version
 */
export const deadlineReminderText = (params: EmailTemplateParams): string => {
  const {
    user_name = '[Student Name]',
    program_name = '[Program Name]',
    university_name = '[University Name]',
    deadline_date = '[Deadline Date]',
    days_left = '[Days Left]',
    portal_url = 'https://admissiontimes.local',
  } = params;

  return `
Hi ${user_name},

DEADLINE REMINDER - Admission Times

This is a reminder that the application deadline for ${program_name} at ${university_name} is on ${deadline_date}.

Days left: ${days_left}

Please review your application and submit before the deadline.

Open Admission Portal:
${portal_url}

---

This is an automated reminder from Admission Times.
© Admission Times
`.trim();
};

/**
 * Generic notification template
 */
export const notificationHtml = (
  title: string,
  body: string,
  ctaText?: string,
  ctaUrl?: string
): string => {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;">
            <tr>
              <td style="background:#0f172a;padding:20px 24px;">
                <h1 style="margin:0;font-size:20px;color:#ffffff;font-weight:700;">Admission Times</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h2 style="margin:0 0 14px 0;font-size:18px;color:#1f2937;">${title}</h2>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#4b5563;">${body}</p>
                ${
                  ctaUrl && ctaText
                    ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;">
                  <tr>
                    <td style="border-radius:8px;background:#0ea5e9;">
                      <a href="${ctaUrl}" style="display:inline-block;padding:11px 16px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                        ${ctaText}
                      </a>
                    </td>
                  </tr>
                </table>
                `
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#64748b;">
                  © Admission Times
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

/**
 * Template factory for easy usage
 */
export const emailTemplates = {
  deadlineReminder: (params: EmailTemplateParams) => ({
    html: deadlineReminderHtml(params),
    text: deadlineReminderText(params),
  }),
  notification: (title: string, body: string, ctaText?: string, ctaUrl?: string) => ({
    html: notificationHtml(title, body, ctaText, ctaUrl),
    text: body,
  }),
};
