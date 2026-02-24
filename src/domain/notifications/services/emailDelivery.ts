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

let transporter: Transporter | null = null;

/**
 * Initialize email transporter on first use (lazy init)
 */
const getTransporter = (): Transporter | null => {
  if (!config.email.enabled) {
    console.log('[EmailDelivery] Email disabled, skipping transport initialization');
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
    dispute_raised: 'New Dispute',
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
  const transport = getTransporter();

  if (!transport) {
    console.log('[EmailDelivery] Skipping email send - transport not available');
    return;
  }

  if (!recipientEmail) {
    console.warn('[EmailDelivery] Skipping email send - no recipient email provided');
    return;
  }

  try {
    const { subject, html, text } = formatEmailContent(notification);

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

    console.log('[EmailDelivery] Email sent successfully:', {
      messageId: info.messageId,
      notificationId: notification.id,
      recipient: recipientEmail,
      type: notification.notification_type,
    });
  } catch (error) {
    // Log but don't throw - email delivery failures shouldn't block notification creation
    console.error('[EmailDelivery] Failed to send email:', {
      error: error instanceof Error ? error.message : String(error),
      notificationId: notification.id,
      recipient: recipientEmail,
    });
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
