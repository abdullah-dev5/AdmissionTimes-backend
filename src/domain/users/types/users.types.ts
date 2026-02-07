/**
 * Users Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the users domain.
 * These types ensure type safety across controllers, services, and models.
 */

import { UserType } from '@config/constants';

/**
 * Core user record interface
 * Matches the database schema
 */
export interface User {
  id: string;
  auth_user_id: string | null; // Supabase Auth UUID (nullable for now)
  role: UserType;
  display_name: string;
  organization_id: string | null; // For university users
  status: 'active' | 'suspended';
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
}

/**
 * Create user DTO (Data Transfer Object)
 * Used for creating new users
 */
export interface CreateUserDTO {
  auth_user_id?: string | null; // Supabase Auth UUID (nullable)
  role: UserType;
  display_name: string;
  organization_id?: string | null; // For university users
  status?: 'active' | 'suspended';
}

/**
 * Update user DTO
 * All fields optional for partial updates
 * Note: role and status can only be updated by admin
 */
export interface UpdateUserDTO {
  display_name?: string;
  organization_id?: string | null;
}

/**
 * Update user role DTO (admin only)
 */
export interface UpdateUserRoleDTO {
  role: UserType;
}

/**
 * University profile record interface
 * Matches the universities table
 */
export interface UniversityProfile {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Update university profile DTO
 */
export interface UpdateUniversityProfileDTO {
  name?: string;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  logo_url?: string | null;
  description?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

/**
 * User filter parameters
 * Used for filtering and searching users
 */
export interface UserFilters {
  role?: UserType | UserType[];
  status?: 'active' | 'suspended';
  organization_id?: string;
  auth_user_id?: string;
}

/**
 * User query parameters
 * Combines filters with pagination and sorting
 */
export interface UserQueryParams extends UserFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * User context interface
 * Attached to requests by auth middleware
 * This is the internal user representation (not Supabase Auth)
 */
export interface UserContext {
  id: string | null; // Internal user ID (users.id)
  auth_user_id: string | null; // Supabase Auth UUID (nullable)
  role: UserType | 'guest';
  organization_id?: string | null;
}
