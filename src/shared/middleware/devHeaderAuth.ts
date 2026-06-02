/**
 * Development-only auth: attach user from x-user-id / x-user-role headers.
 * Used when the frontend has signed in via /auth/signin but has no Supabase JWT yet.
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '@db/connection';
import { UserContext } from '@domain/admissions/types/admissions.types';

export const devHeaderAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.headers['x-user-id'] as string | undefined;
  const headerRole = req.headers['x-user-role'] as string | undefined;
  const headerUniversityId = req.headers['x-university-id'] as string | undefined;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      errors: {
        auth: 'Missing Authorization header or x-user-id (development)',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const userSql = `
      SELECT id::text AS id, email, role, university_id::text AS university_id
      FROM users
      WHERE id = $1
    `;
    const result = await query(userSql, [userId]);

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Invalid user',
        errors: { auth: 'User not found for x-user-id' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const row = result.rows[0];
    const role = (headerRole || row.role || 'student') as UserContext['role'];

    let universityId = row.university_id || headerUniversityId || null;
    if (role === 'university' && !universityId) {
      universityId = headerUniversityId || null;
    }

    req.user = {
      id: row.id,
      role,
      university_id: universityId,
    };

    next();
  } catch (error: any) {
    console.error('devHeaderAuth error:', error?.message || error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      timestamp: new Date().toISOString(),
    });
  }
};
