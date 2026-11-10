/**
 * Email Delivery Service
 * 
 * Handles email notifications using Nodemailer with SMTP transport.
 * Uses Postmark or any SMTP-compatible provider.
 * 
 * Non-blocking: Failures are logged but don't throw to prevent
 * disrupting core notification creation flow.
 */

import nodemailer, { Transporter } from 'nodemailer';
import { config } from '@config/config';
import type { Notification } from '@domain/notifications/types/notifications.types';
import { createEmailDeliveryLog } from '@domain/notifications/models/notifications.model';
import { emailTemplates } from '@shared/email/emailTemplates';
import { createLogger } from '@shared/utils/logger';
import { query } from '@db/connection';
import { calculateDaysRemaining } from '@shared/utils/admissionContract';

const log = createLogger('emailDelivery');

let transporter: Transporter | null = null;
const MAX_EMAIL_SEND_ATTEMPTS = 3;
const EMAIL_RETRY_BASE_DELAY_MS = 1000;

interface EmailReadinessState {
  enabled: boolean;
  ready: boolean;
  lastVerifyAt: string | null;
  lastVerifyError: string | null;
}

const emailReadiness: EmailReadinessState = {
  enabled: config.email.enabled,
  ready: false,
  lastVerifyAt: null,
  lastVerifyError: null,
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const safeWriteEmailLog = async (input: {
  notificationId: string;
  recipientEmail: string;
  subject: string;
  status: 'sent' | 'failed';
  attemptNumber: number;
  errorMessage?: string | null;
  providerMessageId?: string | null;
}): Promise<void> => {
  try {
    await createEmailDeliveryLog({
      notification_id: input.notificationId,
      recipient_email: input.recipientEmail,
      subject: input.subject,
      status: input.status,
      error_message: input.errorMessage || null,
      attempt_number: input.attemptNumber,
      provider_message_id: input.providerMessageId || null,
    });
  } catch (logError) {
    log.error('Failed to write email delivery log (non-blocking):', logError);
  }
};

/**
 * Initialize email transporter on first use (lazy init)
 */
const getTransporter = (): Transporter | null => {
  if (!config.email.enabled) {
    log.debug('Email disabled, skipping transport initialization');
    emailReadiness.enabled = false;
    emailReadiness.ready = false;
    emailReadiness.lastVerifyError = 'Email disabled by configuration';
    return null;
  }

  if (!config.email.user || !config.email.pass) {
    log.error('Email is enabled but SMTP credentials are incomplete (SMTP_USER/SMTP_PASS required)');
    emailReadiness.enabled = true;
    emailReadiness.ready = false;
    emailReadiness.lastVerifyError = 'SMTP credentials incomplete';
    return null;
  }

  if (!transporter) {
    try {
      transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
        pool: true, // Connection pooling for better performance
        maxConnections: 5,
        maxMessages: 100,
      });
      log.debug('SMTP transport initialized:', config.email.host);
    } catch (error) {
      log.error('Failed to initialize SMTP transport:', error);
      emailReadiness.enabled = true;
      emailReadiness.ready = false;
      emailReadiness.lastVerifyError = error instanceof Error ? error.message : String(error);
      return null;
    }
  }

  emailReadiness.enabled = true;
  return transporter;
};

export const verifyEmailTransport = async (): Promise<EmailReadinessState> => {
  emailReadiness.enabled = config.email.enabled;
  emailReadiness.lastVerifyAt = new Date().toISOString();

  const transport = getTransporter();
  if (!transport) {
    emailReadiness.ready = false;
    if (!emailReadiness.lastVerifyError) {
      emailReadiness.lastVerifyError = 'SMTP transport unavailable';
    }
    return { ...emailReadiness };
  }

  try {
    await transport.verify();
    emailReadiness.ready = true;
    emailReadiness.lastVerifyError = null;
    log.debug('SMTP transport verified successfully');
  } catch (error) {
    emailReadiness.ready = false;
    emailReadiness.lastVerifyError = error instanceof Error ? error.message : String(error);
    log.error('SMTP transport verification failed:', error);
  }

  return { ...emailReadiness };
};

export const getEmailDeliveryReadiness = (): EmailReadinessState => {
  return { ...emailReadiness };
};

/**
 * Links in notifications are app paths ("/program/<id>"). Email clients need
 * absolute URLs, so they are joined with WEB_APP_URL; without it the button
 * is omitted rather than sending a broken link.
 */
export const toAbsoluteAppUrl = (link: string | null | undefined): string | undefined => {
  if (!link) return undefined;
  if (/^https?:\/\//i.test(link)) return link;
  if (!config.webAppUrl || !link.startsWith('/')) return undefined;
  return `${config.webAppUrl}${link}`;
};

const formatDeadlineDate = (value: Date): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' }).format(value);

/** Real details for a deadline reminder (the notification only references the deadline row). */
const loadReminderDetails = async (notification: Notification) => {
  if (!notification.related_entity_id) return null;
  const result = await query(
    `SELECT d.deadline_date, a.title, u.name AS university_name, r.display_name AS recipient_name
       FROM deadlines d
       JOIN admissions a ON a.id = d.admission_id
       LEFT JOIN universities u ON u.id = a.university_id
       LEFT JOIN users r ON r.id = $2
      WHERE d.id = $1`,
    [notification.related_entity_id, notification.recipient_id]
  );
  return result.rows[0] || null;
};

const SUBJECTS: Record<string, string> = {
  admission_verified: 'Admission Verified',
  admission_rejected: 'Admission Rejected',
  admission_revision_required: 'Revision Requested',
  admission_updated_saved: 'Admission Updated',
  deadline_near: 'Deadline Reminder',
  admission_submitted: 'New Admission Submitted',
  admission_resubmitted: 'Admission Resubmitted',
  system_broadcast: 'System Announcement',
  system_error: 'System Error',
};

/** Subject and body for a notification email. */
const formatEmailContent = async (notification: Notification): Promise<{ subject: string; html: string; text: string }> => {
  const subject = SUBJECTS[notification.notification_type] || 'New Notification';
  const link = toAbsoluteAppUrl(notification.action_url);

  if (notification.notification_type === 'deadline_near') {
    const details = await loadReminderDetails(notification).catch(() => null);
    if (details?.deadline_date) {
      const deadline = new Date(details.deadline_date);
      const days = calculateDaysRemaining(deadline.toISOString());
      const programName = details.title || notification.title;
      const { html, text } = emailTemplates.deadlineReminder({
        user_name: details.recipient_name || 'there',
        program_name: programName,
        university_name: details.university_name || 'the university',
        deadline_date: formatDeadlineDate(deadline),
        days_left: days <= 0 ? 'less than a day' : days === 1 ? '1 day' : `${days} days`,
        portal_url: link,
      });
      return { subject: `Admission Times | Deadline reminder: ${programName}`, html, text };
    }
  }

  const { html, text } = emailTemplates.notification(
    notification.title || subject,
    notification.message,
    link ? 'View details' : undefined,
    link
  );
  return { subject, html, text };
};

/**
 * Send email notification (non-blocking)
 * @param notification - The notification to send via email
 * @param recipientEmail - The recipient's email address
 */
export const sendNotificationEmail = async (
  notification: Notification,
  recipientEmail: string
): Promise<void> => {
  // Email switched off by configuration: not a delivery failure, so no log row
  // (failed rows would make the retry job and the admin metrics report errors).
  if (!config.email.enabled) return;

  const { subject, html, text } = await formatEmailContent(notification);
  const transport = getTransporter();

  if (!transport) {
    log.debug('Skipping email send - transport not available');
    await safeWriteEmailLog({
      notificationId: notification.id,
      recipientEmail: recipientEmail || 'unknown',
      subject,
      status: 'failed',
      attemptNumber: 1,
      errorMessage: 'SMTP transport unavailable',
    });
    return;
  }

  if (!recipientEmail) {
    log.warn('Skipping email send - no recipient email provided');
    await safeWriteEmailLog({
      notificationId: notification.id,
      recipientEmail: 'unknown',
      subject,
      status: 'failed',
      attemptNumber: 1,
      errorMessage: 'Missing recipient email',
    });
    return;
  }

  for (let attempt = 1; attempt <= MAX_EMAIL_SEND_ATTEMPTS; attempt += 1) {
    try {
      const info = await transport.sendMail({
        from: config.email.from,
        to: recipientEmail,
        subject,
        text,
        html,
        headers: {
          'X-Notification-ID': notification.id,
          'X-Notification-Type': notification.notification_type,
        },
      });

      await safeWriteEmailLog({
        notificationId: notification.id,
        recipientEmail,
        subject,
        status: 'sent',
        attemptNumber: attempt,
        providerMessageId: info.messageId || null,
      });

      log.debug('Email sent successfully:', {
        messageId: info.messageId,
        notificationId: notification.id,
        type: notification.notification_type,
        attempt,
      });
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code ? String((error as any).code) : null;
      const providerResponse = (error as any)?.response ? String((error as any).response) : null;
      const composedErrorMessage = [
        errorCode ? `code=${errorCode}` : null,
        providerResponse ? `response=${providerResponse}` : null,
        `message=${errorMessage}`,
      ]
        .filter(Boolean)
        .join(' | ');

      await safeWriteEmailLog({
        notificationId: notification.id,
        recipientEmail,
        subject,
        status: 'failed',
        attemptNumber: attempt,
        errorMessage: composedErrorMessage,
      });

      log.error('Failed to send email:', {
        error: errorMessage,
        code: errorCode,
        response: providerResponse,
        notificationId: notification.id,
        attempt,
        maxAttempts: MAX_EMAIL_SEND_ATTEMPTS,
      });

      if (attempt < MAX_EMAIL_SEND_ATTEMPTS) {
        const backoffMs = EMAIL_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(backoffMs);
      }
    }
  }
};

/**
 * Gracefully close transport (call on app shutdown)
 */
export const closeTransport = async (): Promise<void> => {
  if (transporter) {
    await transporter.close();
    transporter = null;
    log.debug('SMTP transport closed');
  }
};
