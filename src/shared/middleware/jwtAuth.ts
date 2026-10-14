/**
 * JWT Authentication Middleware
 *
 * Identity comes from the Supabase access token (`sub`, `email`), whose
 * signature is always verified. Authorization data (role, university_id,
 * status) comes ONLY from the `users` table — never from token claims such as
 * `user_metadata`, which end users can edit themselves.
 */

import '../types/express';
import { Request, Response, NextFunction } from 'express';
import { verify, decode, JwtPayload, Algorithm } from 'jsonwebtoken';
import createJwksClient, { JwksClient } from 'jwks-rsa';
import { config } from '@config/config';
import { query } from '@db/connection';
import { USER_TYPE, type UserType } from '@config/constants';
import { UserContext } from '@domain/admissions/types/admissions.types';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('Auth');

interface SupabaseJwtPayload extends JwtPayload {
  sub: string;
  email?: string;
}

interface DbUserRow {
  id: string;
  role: UserType;
  university_id: string | null;
  status: string;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

let jwksClient: JwksClient | null = null;

const getJwksClient = (): JwksClient => {
  if (!config.jwt.jwksUrl) {
    throw new Error('JWKS URL is not configured (set SUPABASE_URL)');
  }
  if (!jwksClient) {
    jwksClient = createJwksClient({
      jwksUri: config.jwt.jwksUrl,
      cache: true,
      cacheMaxAge: 10 * 60 * 1000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }
  return jwksClient;
};

export const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

/**
 * Verify a Supabase access token. Asymmetric tokens (with `kid`) are checked
 * against the project JWKS; legacy HS256 tokens only against SUPABASE_JWT_SECRET.
 */
export const verifyAccessToken = async (token: string): Promise<SupabaseJwtPayload> => {
  const decoded = decode(token, { complete: true });
  if (!decoded || typeof decoded.payload === 'string') {
    throw new Error('Malformed token');
  }

  const { kid, alg } = decoded.header;
  const baseOptions = {
    issuer: config.jwt.issuer || undefined,
    audience: config.jwt.audience,
    clockTolerance: config.jwt.clockToleranceSec,
  };

  let payload: string | JwtPayload;
  if (kid) {
    const key = await getJwksClient().getSigningKey(kid);
    payload = verify(token, key.getPublicKey(), {
      ...baseOptions,
      algorithms: [...config.jwt.algorithms] as Algorithm[],
    });
  } else if (alg === 'HS256' && config.supabase.jwtSecret) {
    payload = verify(token, config.supabase.jwtSecret, { ...baseOptions, algorithms: ['HS256'] });
  } else {
    throw new Error('Unsupported token signature');
  }

  if (typeof payload === 'string' || !payload.sub) {
    throw new Error('Token has no subject');
  }
  return payload as SupabaseJwtPayload;
};

// ---------------------------------------------------------------------------
// User resolution (database is the source of truth for authorization)
// ---------------------------------------------------------------------------

const USER_CACHE_TTL_MS = 30_000;
const userCache = new Map<string, { user: DbUserRow; expiresAt: number }>();

/** Drop cached auth data for a user after role/status/university changes. */
export const invalidateAuthCache = (authUserId?: string | null): void => {
  if (authUserId) userCache.delete(authUserId);
  else userCache.clear();
};

const USER_COLUMNS = 'id::text AS id, role, university_id::text AS university_id, status, email';

const findByAuthUserId = async (authUserId: string): Promise<DbUserRow | null> => {
  const result = await query(`SELECT ${USER_COLUMNS} FROM users WHERE auth_user_id = $1`, [authUserId]);
  return result.rows[0] || null;
};

/**
 * First authenticated request for a Supabase user: link a pre-existing
 * profile with the same email (legacy rows without auth_user_id), otherwise
 * create a student profile. Self-service accounts are always students;
 * university and admin accounts are provisioned by admins.
 */
const provisionUser = async (payload: SupabaseJwtPayload): Promise<DbUserRow> => {
  const email = payload.email?.trim().toLowerCase() || null;

  if (email) {
    const linked = await query(
      `UPDATE users SET auth_user_id = $1, updated_at = NOW()
       WHERE lower(email) = $2 AND auth_user_id IS NULL AND role <> 'admin'
       RETURNING ${USER_COLUMNS}`,
      [payload.sub, email]
    );
    if (linked.rows[0]) {
      log.info(`Linked existing profile ${linked.rows[0].id} to auth user`);
      return linked.rows[0];
    }
  }

  const displayName = (payload.user_metadata?.display_name as string | undefined)?.trim() || email?.split('@')[0] || 'User';

  try {
    await query(
      `INSERT INTO users (auth_user_id, email, role, display_name, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (auth_user_id) DO NOTHING`,
      [payload.sub, email, USER_TYPE.STUDENT, displayName]
    );
  } catch (error: any) {
    if (error?.code === '23505') {
      // Email already belongs to a different auth identity.
      throw Object.assign(new Error('This email is linked to another account'), { status: 409 });
    }
    throw error;
  }

  const created = await findByAuthUserId(payload.sub);
  if (!created) throw new Error('Failed to provision user profile');
  log.info(`Provisioned student profile ${created.id}`);
  return created;
};

const resolveUser = async (payload: SupabaseJwtPayload): Promise<DbUserRow> => {
  const cached = userCache.get(payload.sub);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const user = (await findByAuthUserId(payload.sub)) || (await provisionUser(payload));
  userCache.set(payload.sub, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  return user;
};

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

const deny = (res: Response, status: number, message: string, detail?: string): void => {
  res.status(status).json({
    success: false,
    message,
    ...(detail ? { errors: { auth: detail } } : {}),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Require a valid Supabase access token and attach `req.user`.
 */
export const jwtAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = extractBearerToken(req);
  if (!token) {
    deny(res, 401, 'Authentication required', 'Missing Authorization: Bearer <token> header');
    return;
  }

  let payload: SupabaseJwtPayload;
  try {
    payload = await verifyAccessToken(token);
  } catch (error: any) {
    const expired = error?.name === 'TokenExpiredError';
    log.debug(`Token rejected: ${error?.message}`);
    deny(res, 401, expired ? 'Token expired' : 'Invalid authentication token', expired ? 'Your session has expired. Please sign in again.' : undefined);
    return;
  }

  try {
    const user = await resolveUser(payload);
    if (user.status !== 'active') {
      deny(res, 403, 'Account suspended', 'Contact an administrator to restore access.');
      return;
    }

    req.user = {
      id: user.id,
      role: user.role,
      university_id: user.university_id,
      email: user.email || payload.email || null,
      auth_user_id: payload.sub,
    };
    next();
  } catch (error: any) {
    if (error?.status === 409) {
      deny(res, 409, error.message);
      return;
    }
    next(error);
  }
};

type AllowedRole = Exclude<UserContext['role'], 'guest'>;

/**
 * Restrict a route to specific roles. Must run after authentication.
 */
export const requireRole = (allowedRoles: AllowedRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.id) {
      deny(res, 401, 'Authentication required');
      return;
    }
    if (!allowedRoles.includes(req.user.role as AllowedRole)) {
      deny(res, 403, 'Insufficient permissions', `Requires one of: ${allowedRoles.join(', ')}`);
      return;
    }
    next();
  };
};
