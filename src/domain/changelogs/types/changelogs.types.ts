/**
 * Changelogs Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the changelogs domain.
 * These types ensure type safety across controllers, services, and models.
 */

/**
 * Core changelog record interface
 * Matches the database schema
 */
export interface Changelog {
  id: string;
  admission_id: string;
  actor_type: 'admin' | 'university' | 'system';
  changed_by: string | null;
  action_type: 'created' | 'updated' | 'verified' | 'rejected' | 'disputed' | 'status_changed';
  field_name: string | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  diff_summary: string | null;
  metadata: Record<string, any> | null;
  created_at: string; // ISO8601 timestamp
}

/**
 * Changelog filter parameters
 * Used for filtering changelogs
 */
export interface ChangelogFilters {
  admission_id?: string;
  actor_type?: 'admin' | 'university' | 'system' | Array<'admin' | 'university' | 'system'>;
  action_type?: 'created' | 'updated' | 'verified' | 'rejected' | 'disputed' | 'status_changed' | Array<string>;
  changed_by?: string;
  date_from?: string; // ISO8601 date
  date_to?: string; // ISO8601 date
  search?: string; // Search in diff_summary
}

/**
 * Changelog query parameters
 * Combines filters with pagination and sorting
 */
export interface ChangelogQueryParams extends ChangelogFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
