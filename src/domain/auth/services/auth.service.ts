/**
 * Auth Domain - Service Layer
 *
 * Supabase Auth owns credentials and sessions. This service:
 * - creates the application profile for a newly registered Supabase user,
 *   after proving that the supplied auth_user_id really belongs to the email;
 * - offers password sign-in for API clients that cannot use the Supabase SDK;
 * - returns the current profile.
 */

import { AppError } from '@shared/middleware/errorHandler';
import { query } from '@db/connection';
import { getSupabaseAdminClient, getSupabaseAnonClient } from '@shared/supabase/clients';
import { createLogger } from '@shared/utils/logger';
import * as authModel from '../models/auth.model';
import { SignUpDTO, SignInDTO, SignUpResponse, SignInResponse, AuthUser } from '../types/auth.types';

const log = createLogger('AuthService');

/** Supabase identities may be at most this old when claimed via signup. */
const SIGNUP_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

const DEFAULT_NOTIFICATION_CATEGORIES = { verification: true, deadline: true, system: true, update: true };

const initializePreferences = async (userId: string): Promise<void> => {
  try {
    await query(
      `INSERT INTO user_preferences (user_id, email_notifications_enabled, push_notifications_enabled, notification_categories)
       VALUES ($1, true, true, $2::jsonb)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, JSON.stringify(DEFAULT_NOTIFICATION_CATEGORIES)]
    );
  } catch (error) {
    // Preferences fall back to defaults when missing; never block signup.
    log.warn(`Could not initialize preferences for ${userId}`, (error as Error)?.message);
  }
};

/**
 * Confirm via the Supabase Admin API that `authUserId` exists, belongs to
 * `email`, and was created recently. Prevents claiming someone else's identity.
 */
const assertIdentityOwnership = async (authUserId: string, email: string): Promise<void> => {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new AppError('Signup is unavailable: Supabase service role is not configured', 503);
  }

  const { data, error } = await admin.auth.admin.getUserById(authUserId);
  const authUser = data?.user;
  if (error || !authUser) {
    throw new AppError('Unknown authentication identity', 400, true, { auth_user_id: 'No such Supabase user' });
  }

  if ((authUser.email || '').toLowerCase() !== email.toLowerCase()) {
    throw new AppError('Email does not match the authentication identity', 400, true, {
      email: 'Email does not match the Supabase account',
    });
  }

  const createdAt = Date.parse(authUser.created_at);
  if (Number.isFinite(createdAt) && Date.now() - createdAt > SIGNUP_CLAIM_WINDOW_MS) {
    throw new AppError('This identity can no longer be claimed through signup. Sign in instead.', 409);
  }
};

/**
 * Create the student profile for a Supabase user created by the client.
 */
export const signUp = async (data: SignUpDTO): Promise<SignUpResponse> => {
  const email = data.email.trim().toLowerCase();
  await assertIdentityOwnership(data.auth_user_id, email);

  const existingByIdentity = await authModel.findByAuthUserId(data.auth_user_id);
  if (existingByIdentity) {
    return { user: existingByIdentity, message: 'Account already exists' };
  }

  const existingByEmail = await authModel.findByEmail(email);
  let user: AuthUser;

  if (existingByEmail) {
    if (existingByEmail.auth_user_id || existingByEmail.role === 'admin') {
      throw new AppError('Email already exists', 409, true, { email: 'Email already exists' });
    }
    // Legacy profile without an auth identity: attach it.
    const linked = await authModel.linkAuthIdentity(existingByEmail.id, data.auth_user_id);
    if (!linked) throw new AppError('Email already exists', 409, true, { email: 'Email already exists' });
    user = linked;
  } else {
    user = await authModel.createStudentProfile({
      auth_user_id: data.auth_user_id,
      email,
      display_name: data.display_name?.trim() || email.split('@')[0],
    });
  }

  await initializePreferences(user.id);
  return { user, message: 'Account created successfully' };
};

/**
 * Password sign-in through Supabase for API clients (scripts, tests, tools).
 * The web and mobile apps sign in with the Supabase SDK directly.
 */
export const signIn = async (data: SignInDTO): Promise<SignInResponse> => {
  const supabase = getSupabaseAnonClient();
  if (!supabase) {
    throw new AppError('Sign-in is unavailable: Supabase is not configured', 503);
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: data.email.trim().toLowerCase(),
    password: data.password,
  });

  if (error || !authData.session || !authData.user) {
    const unconfirmed = error?.message?.toLowerCase().includes('email not confirmed');
    throw new AppError(
      unconfirmed ? 'Please verify your email before signing in' : 'Invalid email or password',
      unconfirmed ? 403 : 401
    );
  }

  const user = await authModel.findByAuthUserId(authData.user.id);
  if (!user) {
    // First sign-in for a self-registered user whose profile was never created:
    // the JWT middleware provisions it on the first authenticated request.
    throw new AppError('Profile not initialized yet. Call GET /auth/me with the access token.', 409);
  }
  if (user.status !== 'active') {
    throw new AppError('Account suspended', 403);
  }

  return {
    user,
    message: 'Signed in successfully',
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    expires_at: authData.session.expires_at,
  };
};

export const getCurrentUser = async (userId: string): Promise<AuthUser> => {
  const user = await authModel.findUserById(userId);
  if (!user) {
    throw new AppError('User not found', 401);
  }
  return user;
};
