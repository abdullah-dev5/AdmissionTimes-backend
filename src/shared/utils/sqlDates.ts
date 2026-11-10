/**
 * SQL counterpart of admissionContract.calculateDaysRemaining: calendar days
 * from today to the deadline day, both in the app timezone (Pakistan).
 * `column` must be a trusted column expression, never user input.
 */
export const APP_TIMEZONE = 'Asia/Karachi';

export const sqlDaysLeft = (column: string): string =>
  `((${column} AT TIME ZONE '${APP_TIMEZONE}')::date - (NOW() AT TIME ZONE '${APP_TIMEZONE}')::date)`;
