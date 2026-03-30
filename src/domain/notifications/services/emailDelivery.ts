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
    console.error('[EmailDelivery] Failed to write email delivery log (non-blocking):', logError);
  }
};

/**
 * Initialize email transporter on first use (lazy init)
 */
const getTransporter = (): Transporter | null => {
  if (!config.email.enabled) {
    console.log('[EmailDelivery] Email disabled, skipping transport initialization');
    emailReadiness.enabled = false;
    emailReadiness.ready = false;
    emailReadiness.lastVerifyError = 'Email disabled by configuration';
    return null;
  }

  if (!config.email.user || !config.email.pass) {
    console.error('[EmailDelivery] Email is enabled but SMTP credentials are incomplete (SMTP_USER/SMTP_PASS required)');
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
      console.log('[EmailDelivery] SMTP transport initialized:', config.email.host);
    } catch (error) {
      console.error('[EmailDelivery] Failed to initialize SMTP transport:', error);
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
    console.log('[EmailDelivery] SMTP transport verified successfully');
  } catch (error) {
    emailReadiness.ready = false;
    emailReadiness.lastVerifyError = error instanceof Error ? error.message : String(error);
    console.error('[EmailDelivery] SMTP transport verification failed:', error);
  }

  return { ...emailReadiness };
};

export const getEmailDeliveryReadiness = (): EmailReadinessState => {
  return { ...emailReadiness };
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

  // Use branded template for deadline reminders
  if (notification.notification_type === 'deadline_near') {
    // Extract deadline info from notification title/message or use defaults
    const programName = notification.title || 'Application';
    const universityName = notification.university_name || 'University';
    
    const { html, text } = emailTemplates.deadlineReminder({
      user_name: 'Student',
      program_name: programName,
      university_name: universityName,
      deadline_date: 'upcoming',
      days_left: '7', // Default, can be updated if stored in message parsing
      portal_url: notification.action_url || 'https://admissiontimes.local',
    });
    
    return {
      subject: `Admission Times | Deadline reminder: ${programName}`,
      html,
      text,
    };
  }

  // Generic branded template for other notifications
  const { html, text } = emailTemplates.notification(
    subject,
    notification.message,
    notification.action_url ? 'View Details' : undefined,
    notification.action_url || undefined
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

      console.error('[EmailDelivery] Failed to send email:', {
        error: errorMessage,
        code: errorCode,
        response: providerResponse,
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
