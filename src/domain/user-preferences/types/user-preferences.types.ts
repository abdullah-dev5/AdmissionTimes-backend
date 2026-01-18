/**
 * User Preferences Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the user preferences domain.
 * These types ensure type safety across controllers, services, and models.
 */

/**
 * Email frequency options
 */
export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never';

/**
 * Language options
 */
export type Language = 'en' | 'ar' | 'fr' | 'es';

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'auto';

/**
 * Notification category preferences
 */
export interface NotificationCategories {
  verification?: boolean;
  deadline?: boolean;
  system?: boolean;
  update?: boolean;
}

/**
 * Core user preferences record interface
 * Matches the database schema
 */
export interface UserPreferences {
  id: string;
  user_id: string;
  email_notifications_enabled: boolean;
  email_frequency: EmailFrequency;
  push_notifications_enabled: boolean;
  notification_categories: NotificationCategories;
  language: Language;
  timezone: string;
  theme: Theme;
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
}

/**
 * Update user preferences DTO
 * All fields optional for partial updates
 */
export interface UpdateUserPreferencesDTO {
  email_notifications_enabled?: boolean;
  email_frequency?: EmailFrequency;
  push_notifications_enabled?: boolean;
  notification_categories?: NotificationCategories;
  language?: Language;
  timezone?: string;
  theme?: Theme;
}
