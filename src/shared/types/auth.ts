/**
 * Authenticated caller context, attached to `req.user` by the auth middleware.
 * Role and university_id always come from the `users` table.
 */
export type UserRole = 'student' | 'university' | 'admin' | 'maintenance';

export interface UserContext {
  id: string | null;
  role: UserRole | 'guest';
  university_id?: string | null;
  email?: string | null;
  /** Supabase Auth subject (only set for JWT-authenticated requests). */
  auth_user_id?: string | null;
}

/** Context for routes that run behind authentication (id is always set). */
export interface AuthenticatedUserContext extends UserContext {
  id: string;
}
