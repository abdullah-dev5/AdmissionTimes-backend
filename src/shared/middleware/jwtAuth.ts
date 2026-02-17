/**
 * JWT Authentication Middleware (Phase 1: JWKS Verification)
 *
 * Validates Supabase JWT tokens with cryptographic signature verification.
 * Attaches user context from verified JWT claims to requests.
 * 
 * Features:
 * - JWKS signature verification (production-grade security)
 * - Fallback to dev mode (decode-only) if JWKS not available
 * - Token expiration checking
 * - Role-based access control support
 * - User metadata extraction (role, university_id)
 */

import { Request, Response, NextFunction } from 'express';
import { verify, decode } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import createClient from 'jwks-rsa';
import { config } from '@config/config';
import { UserContext } from '@domain/admissions/types/admissions.types';
import { query } from '@db/connection';

/**
 * Extended JWT payload from Supabase Auth
 */
interface SupabaseJwtPayload {
  sub: string; // User ID (UUID)
  exp?: number; // Expiration timestamp (seconds since epoch)
  iat?: number; // Issued at timestamp
  iss?: string; // Issuer
  aud?: string; // Audience
  role?: string; // Database role
  email?: string; // User email
  app_metadata?: {
    provider?: string;
    [key: string]: any;
  };
  user_metadata?: {
    role?: 'student' | 'university' | 'admin';
    university_id?: string;
    [key: string]: any;
  };
}

/**
 * Initialize JWKS client for Supabase
 * Cached to avoid multiple JWKS endpoint requests
 */
let jwksClient: JwksClient;

const getJwksClient = (): JwksClient => {
  if (!jwksClient) {
    const jwksUrl = config.jwt.jwksUrl || 'https://lufhgsgubvxjrrcsevte.supabase.co/.well-known/jwks.json';
    jwksClient = createClient({
      jwksUri: jwksUrl,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
    });
  }
  return jwksClient;
};

/**
 * Extract JWT token from Authorization header
 *
 * Expected format: "Bearer <token>"
 *
 * @param req - Express request object
 * @returns JWT token or null if not found
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Decode JWT payload without verification (DEV MODE ONLY)
 * Used in development when signature verification is not available
 */
const decodeJwtPayload = (token: string): SupabaseJwtPayload | null => {
  try {
    const decoded = decode(token) as SupabaseJwtPayload | null;
    return decoded;
  } catch (error) {
    console.error('❌ Failed to decode JWT payload:', error);
    return null;
  }
};

/**
 * Ensure user exists in database (auto-sync from Supabase Auth)
 * Creates user if they exist in Supabase Auth but not in our users table
 * Returns the database user ID (not auth_user_id)
 * 
 * ENSURES ROLE CONSISTENCY:
 * - Supabase Auth is source of truth (immutable user_metadata)
 * - Database role is synced on every request
 * - If roles diverge, Supabase Auth takes precedence
 */
const ensureUserExists = async (payload: SupabaseJwtPayload): Promise<string> => {
  const authUserId = payload.sub;
  const email = payload.email;
  const userRole = payload.user_metadata?.role || 'student';

  // Check if user exists and get their database ID
  const checkSql = 'SELECT id, role FROM users WHERE auth_user_id = $1';
  const result = await query(checkSql, [authUserId]);

  if (result.rows.length > 0) {
    // User exists - verify role consistency
    const existingUser = result.rows[0];
    
    if (existingUser.role !== userRole) {
      console.warn(
        `⚠️ [ROLE-SYNC] Role mismatch detected for ${email}:`,
        `DB: ${existingUser.role}, JWT: ${userRole}. Syncing to JWT value...`
      );
      
      // Sync database role to match Supabase Auth (source of truth)
      const syncSql = 'UPDATE users SET role = $1 WHERE id = $2';
      await query(syncSql, [userRole, existingUser.id]);
    }
    
    return existingUser.id;
  }

  // User doesn't exist, create them
  console.log(`🔄 [AUTO-SYNC] User ${email} exists in Supabase Auth but not in database. Creating...`);

  const insertSql = `
    INSERT INTO users (auth_user_id, email, role, display_name, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (auth_user_id) DO NOTHING
    RETURNING id
  `;

  const displayName = email ? email.split('@')[0] : 'User';

  const insertResult = await query(insertSql, [
    authUserId,
    email,
    userRole,
    displayName,
    'active',
  ]);

  console.log(`✅ [AUTO-SYNC] Created user ${email} in database with role: ${userRole}`);
  return insertResult.rows[0].id;
};

/**
 * Get signing key from JWKS endpoint
 */
const getSigningKey = async (kid: string | undefined): Promise<string> => {
  if (!kid) {
    throw new Error('No key ID (kid) in JWT header');
  }

  const client = getJwksClient();
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
};

/**
 * Verify JWT signature with JWKS (PRODUCTION MODE)
 */
const verifyJwtSignature = async (token: string): Promise<SupabaseJwtPayload> => {
  try {
    // Decode header to get kid
    const decoded: any = decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error('Invalid JWT format or missing key ID');
    }

    // Get signing key from JWKS
    const signingKey = await getSigningKey(decoded.header.kid);

    // Verify signature
    const verified = verify(token, signingKey, {
      algorithms: ['RS256', 'HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as SupabaseJwtPayload;

    return verified;
  } catch (error: any) {
    console.error('❌ JWT signature verification failed:', error.message);
    throw new Error(`JWT verification failed: ${error.message}`);
  }
};

/**
 * JWT Authentication Middleware (Required)
 *
 * Validates JWT token with signature verification and attaches user context to request.
 * Returns 401 if token is missing, invalid, or expired.
 *
 * Production: Uses JWKS for RS256 signature verification
 * Development: Falls back to decode-only if JWKS unavailable
 *
 * Usage:
 * app.use('/api/v1', jwtAuth); // All routes under /api/v1 require auth
 */
export const jwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      errors: {
        auth: 'Missing or invalid Authorization header. Expected format: Bearer <token>',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    let payload: SupabaseJwtPayload;

    // Try JWKS verification (production)
    if (config.env === 'production') {
      console.log('🔐 [PROD] Verifying JWT signature with JWKS...');
      payload = await verifyJwtSignature(token);
    } else {
      // Development: Try JWKS first, fall back to decode-only
      try {
        console.log('🔐 [DEV] Attempting JWKS verification...');
        payload = await verifyJwtSignature(token);
      } catch (jwksError) {
        console.warn('⚠️ [DEV] JWKS verification failed, falling back to decode-only:', jwksError);
        const decodedPayload = decodeJwtPayload(token);
        if (!decodedPayload || !decodedPayload.sub) {
          throw new Error('Failed to decode JWT or extract user ID');
        }
        payload = decodedPayload;
      }
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      res.status(401).json({
        success: false,
        message: 'Token expired',
        errors: {
          auth: 'Your session has expired. Please log in again.',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Auto-sync user from Supabase Auth to database if needed
    // This returns the database user ID (not auth_user_id)
    const databaseUserId = await ensureUserExists(payload);

    // Extract user context from verified token
    const userRole = payload.user_metadata?.role || 'student';
    const universityId = payload.user_metadata?.university_id || null;
    const email = payload.email || null;

    req.user = {
      id: databaseUserId, // Use database ID, not Supabase auth_user_id
      role: userRole as 'student' | 'university' | 'admin',
      university_id: universityId,
      email: email,
    } as UserContext;

    console.log('✅ [JWT] User authenticated:', { 
      userId: databaseUserId, 
      userRole,
      email,
      endpoint: req.path,
      method: req.method,
      authUserId: payload.sub,
    });
    console.log('✅ [JWT] Full JWT payload:', {
      sub: payload.sub,
      email: payload.email,
      iat: payload.iat,
      exp: payload.exp,
      user_metadata: payload.user_metadata,
      app_metadata: payload.app_metadata,
    });
    next();
  } catch (error: any) {
    console.error('❌ JWT validation error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      errors: {
        auth: error.message || 'Token validation failed',
      },
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Optional JWT Authentication Middleware
 *
 * Attempts to validate JWT token if present, but allows request to proceed
 * even if token is missing or invalid. Useful for public endpoints that
 * behave differently for authenticated users.
 */
export const optionalJwtAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractToken(req);

  if (!token) {
    // No token - continue as guest
    req.user = {
      id: null,
      role: 'guest',
      university_id: null,
    } as UserContext;
    next();
    return;
  }

  try {
    let payload: SupabaseJwtPayload | null = null;

    // Try to verify JWT
    try {
      payload = await verifyJwtSignature(token);
    } catch {
      // Fall back to decode-only
      payload = decodeJwtPayload(token);
    }

    if (!payload || !payload.sub) {
      throw new Error('Invalid token payload');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    // Token is valid - attach user
    req.user = {
      id: payload.sub,
      role: payload.user_metadata?.role || 'student',
      university_id: payload.user_metadata?.university_id || null,
      email: payload.email || null,
    } as UserContext;

    console.log('✅ Optional auth succeeded:', req.user.id);
  } catch (error) {
    console.warn('⚠️ Optional auth failed, continuing as guest');
    // Error decoding token - continue as guest
    req.user = {
      id: null,
      role: 'guest',
      university_id: null,
    } as UserContext;
  }

  next();
};

/**
 * Role-based Access Control Middleware Factory
 *
 * Creates middleware that checks if user has required role(s).
 * Must be used AFTER jwtAuth middleware.
 */
export const requireRole = (allowedRoles: Array<'student' | 'university' | 'admin'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as any)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        errors: {
          role: `This endpoint requires one of: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};
