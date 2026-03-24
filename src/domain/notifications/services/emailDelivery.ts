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

let transporter: Transporter | null = null;
const MAX_EMAIL_SEND_ATTEMPTS = 3;
const EMAIL_RETRY_BASE_DELAY_MS = 1000;

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
    console.error('[EmailDelivery] Failed to write email delivery log (non-blocking):', logError);
  }
};

/**
 * Initialize email transporter on first use (lazy init)
 */
const getTransporter = (): Transporter | null => {
  if (!config.email.enabled) {
    console.log('[EmailDelivery] Email disabled, skipping transport initialization');
    return null;
  }

  if (!config.email.user || !config.email.pass) {
    console.error('[EmailDelivery] Email is enabled but SMTP credentials are incomplete (SMTP_USER/SMTP_PASS required)');
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
      console.log('[EmailDelivery] SMTP transport initialized:', config.email.host);
    } catch (error) {
      console.error('[EmailDelivery] Failed to initialize SMTP transport:', error);
      return null;
    }
  }

  return transporter;
};

/**
 * Generate email subject and body from notification
 */
const formatEmailContent = (notification: Notification): { subject: string; html: string; text: string } => {
  const typeLabels: Record<string, string> = {
    admission_verified: 'Admission Verified',
    admission_rejected: 'Admission Rejected',
    admission_updated_saved: 'Admission Updated',
    deadline_near: 'Deadline Reminder',
    admission_submitted: 'New Admission Submitted',
    system_broadcast: 'System Announcement',
  };

  const subject = typeLabels[notification.notification_type] || 'New Notification';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background: #f9fafb; padding: 20px; margin: 20px 0; }
          .footer { text-align: center; font-size: 12px; color: #6b7280; margin-top: 20px; }
          .btn { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 4px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          <div class="content">
            <p>${notification.message}</p>
            ${notification.action_url ? `<a href="${notification.action_url}" class="btn">View Details</a>` : ''}
          </div>
          <div class="footer">
            <p>You received this email because you have notifications enabled for Admission Times.</p>
            <p>To unsubscribe, please update your preferences in your account settings.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
${subject}

${notification.message}

${notification.action_url ? `View details: ${notification.action_url}` : ''}

---
You received this email because you have notifications enabled for Admission Times.
To unsubscribe, please update your preferences in your account settings.
  `.trim();

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
  const { subject, html, text } = formatEmailContent(notification);
  const transport = getTransporter();

  if (!transport) {
    console.log('[EmailDelivery] Skipping email send - transport not available');
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
    console.warn('[EmailDelivery] Skipping email send - no recipient email provided');
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

      console.log('[EmailDelivery] Email sent successfully:', {
        messageId: info.messageId,
        notificationId: notification.id,
        recipient: recipientEmail,
        type: notification.notification_type,
        attempt,
      });
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await safeWriteEmailLog({
        notificationId: notification.id,
        recipientEmail,
        subject,
        status: 'failed',
        attemptNumber: attempt,
        errorMessage,
      });

      console.error('[EmailDelivery] Failed to send email:', {
        error: errorMessage,
        code: (error as any)?.code,
        response: (error as any)?.response,
        notificationId: notification.id,
        recipient: recipientEmail,
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
    console.log('[EmailDelivery] SMTP transport closed');
  }
};
