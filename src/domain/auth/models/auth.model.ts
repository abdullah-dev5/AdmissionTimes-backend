/**
 * Auth Domain - Model Layer
 * 
 * Database access layer for authentication.
 * Contains all raw SQL queries with parameterized statements.
 */

import { query } from '@db/connection';
import { SignUpDTO, AuthUser } from '../types/auth.types';

/**
 * Find user by email
 * 
 * @param email - User email
 * @returns User record with password or null if not found
 */
export const findByEmail = async (email: string): Promise<any | null> => {
  const sql = 'SELECT * FROM users WHERE email = $1';
  const result = await query(sql, [email]);
  return result.rows[0] || null;
};

/**
 * Check if email exists
 * 
 * @param email - User email
 * @returns True if email exists, false otherwise
 */
export const emailExists = async (email: string): Promise<boolean> => {
  const sql = 'SELECT COUNT(*) as count FROM users WHERE email = $1';
  const result = await query(sql, [email]);
  return parseInt(result.rows[0].count, 10) > 0;
};

/**
 * Create a new user (sign up)
 * 
 * @param data - Sign up data
 * @returns Created user record (without password)
 */
export const createUser = async (data: SignUpDTO): Promise<AuthUser> => {
  const sql = `
    INSERT INTO users (
      email, password, role, display_name, organization_id, status
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, role, organization_id, display_name, created_at, updated_at
  `;

  const params = [
    data.email,
    data.password, // Plain text for now
    data.user_type,
    data.display_name || data.email.split('@')[0], // Default to email prefix if no display name
    data.university_id || null,
    'active',
  ];

  const result = await query(sql, params);
  const user = result.rows[0];

  return {
    id: user.id,
    email: user.email,
    role: user.role as any, // Map role to user_type
    university_id: user.organization_id, // Map organization_id to university_id in response
    display_name: user.display_name,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};

/**
 * Verify user credentials (sign in)
 * 
 * @param email - User email
 * @param password - User password
 * @returns User record (without password) or null if invalid
 */
export const verifyCredentials = async (
  email: string,
  password: string
): Promise<AuthUser | null> => {
  const sql = 'SELECT * FROM users WHERE email = $1 AND password = $2';
  const result = await query(sql, [email, password]);

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  return {
    id: user.id,
    email: user.email,
    role: user.role as any, // Map role to user_type
    university_id: user.organization_id,
    display_name: user.display_name,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};

/**
 * Find user by ID (for getCurrentUser)
 * 
 * @param id - User UUID
 * @returns User record (without password) or null if not found
 */
export const findUserById = async (id: string): Promise<AuthUser | null> => {
  const sql = `
    SELECT id, email, role, organization_id, display_name, created_at, updated_at
    FROM users
    WHERE id = $1
  `;
  const result = await query(sql, [id]);

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  return {
    id: user.id,
    email: user.email,
    role: user.role as any, // Map role to user_type
    university_id: user.organization_id,
    display_name: user.display_name,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};
