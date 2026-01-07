/**
 * Date utility functions
 * 
 * Helper functions for date calculations, especially for deadlines.
 */

import { DEADLINE_URGENCY } from '../../config/constants';

/**
 * Calculate days remaining until a deadline
 * 
 * @param deadlineDate - The deadline date
 * @returns Number of days remaining (can be negative if expired)
 */
export const calculateDaysRemaining = (deadlineDate: Date): number => {
  const now = new Date();
  const deadline = new Date(deadlineDate);
  
  const diffTime = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Determine urgency level based on days remaining
 * 
 * @param daysRemaining - Number of days remaining
 * @returns Urgency level: 'expired', 'urgent', 'warning', or 'normal'
 */
export const getUrgencyLevel = (daysRemaining: number): 'expired' | 'urgent' | 'warning' | 'normal' => {
  if (daysRemaining < DEADLINE_URGENCY.EXPIRED) {
    return 'expired';
  }
  if (daysRemaining <= DEADLINE_URGENCY.URGENT) {
    return 'urgent';
  }
  if (daysRemaining <= DEADLINE_URGENCY.WARNING) {
    return 'warning';
  }
  return 'normal';
};

/**
 * Format date for display
 * 
 * @param date - Date to format
 * @param includeTime - Whether to include time
 * @returns Formatted date string
 */
export const formatDate = (date: Date | string, includeTime: boolean = false): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return d.toLocaleDateString('en-US', options);
};

/**
 * Check if a date is in the past
 * 
 * @param date - Date to check
 * @returns True if date is in the past
 */
export const isPast = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d < new Date();
};

/**
 * Check if a date is in the future
 * 
 * @param date - Date to check
 * @returns True if date is in the future
 */
export const isFuture = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d > new Date();
};
