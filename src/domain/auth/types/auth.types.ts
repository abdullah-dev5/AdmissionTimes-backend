/**
 * Auth Domain - Types
 */

import { UserType } from '@config/constants';

export interface SignUpDTO {
  email: string;
  password?: string;
  user_type: 'student';
  display_name?: string;
  /** Supabase Auth user id created by the client via supabase.auth.signUp. */
  auth_user_id: string;
}

export interface SignInDTO {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  role: UserType;
  university_id: string | null;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SignUpResponse {
  user: AuthUser;
  message: string;
}

export interface SignInResponse {
  user: AuthUser;
  message: string;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}
