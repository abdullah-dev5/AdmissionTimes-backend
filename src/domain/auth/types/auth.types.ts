/**
 * Auth Domain - TypeScript Types
 * 
 * Defines all TypeScript interfaces and types for the authentication domain.
 */

import { UserType } from '@config/constants';

/**
 * Sign up request DTO
 */
export interface SignUpDTO {
  email: string;
  password: string;
  user_type: UserType;
  display_name?: string;
  university_id?: string; // Required if user_type is 'university'
  auth_user_id?: string; // Supabase Auth UUID (optional)
}

/**
 * Sign in request DTO
 */
export interface SignInDTO {
  email: string;
  password: string;
}

/**
 * Auth user response (user without password)
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserType;
  university_id: string | null;
  display_name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Sign up response
 */
export interface SignUpResponse {
  user: AuthUser;
  message: string;
}

/**
 * Sign in response
 */
export interface SignInResponse {
  user: AuthUser;
  message: string;
}
