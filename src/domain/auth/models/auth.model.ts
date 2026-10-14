/**
 * Auth Domain - Model
 *
 * Credentials live in Supabase Auth only; this table stores the profile and
 * authorization data (role, university, status).
 */

import { query } from '@db/connection';
import { AuthUser } from '../types/auth.types';

const PROFILE_COLUMNS = `
  id::text AS id, email, role, university_id::text AS university_id,
  display_name, status, created_at, updated_at`;

export const findByEmail = async (email: string): Promise<(AuthUser & { auth_user_id: string | null }) | null> => {
  const result = await query(
    `SELECT ${PROFILE_COLUMNS}, auth_user_id::text AS auth_user_id FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return result.rows[0] || null;
};

export const findByAuthUserId = async (authUserId: string): Promise<AuthUser | null> => {
  const result = await query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE auth_user_id = $1`, [authUserId]);
  return result.rows[0] || null;
};

export const findUserById = async (id: string): Promise<AuthUser | null> => {
  const result = await query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

/**
 * Create a student profile for a verified Supabase identity. Idempotent per
 * auth_user_id, so a retried signup never fails.
 */
export const createStudentProfile = async (data: {
  auth_user_id: string;
  email: string;
  display_name: string;
}): Promise<AuthUser> => {
  await query(
    `INSERT INTO users (auth_user_id, email, role, display_name, status)
     VALUES ($1, $2, 'student', $3, 'active')
     ON CONFLICT (auth_user_id) DO NOTHING`,
    [data.auth_user_id, data.email, data.display_name]
  );

  const user = await findByAuthUserId(data.auth_user_id);
  if (!user) throw new Error('Failed to create user profile');
  return user;
};

/** Attach a Supabase identity to a legacy profile created before auth existed. */
export const linkAuthIdentity = async (userId: string, authUserId: string): Promise<AuthUser | null> => {
  const result = await query(
    `UPDATE users SET auth_user_id = $2, updated_at = NOW()
     WHERE id = $1 AND auth_user_id IS NULL
     RETURNING ${PROFILE_COLUMNS}`,
    [userId, authUserId]
  );
  return result.rows[0] || null;
};
