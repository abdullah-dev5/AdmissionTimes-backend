/**
 * Development-only header authentication.
 *
 * Enabled only via ALLOW_DEV_HEADER_AUTH=true outside production (see apiAuth).
 * Impersonates an existing user by `x-user-id`; role and university always
 * come from that user's database row — headers can never elevate privileges.
 */

import { Request, Response, NextFunction } from 'express';
import { query } from '@db/connection';

export const devHeaderAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userId = String(req.headers['x-user-id'] || '').trim();

  try {
    const result = await query(
      `SELECT id::text AS id, email, role, university_id::text AS university_id, status
       FROM users WHERE id = $1`,
      [userId]
    );
    const row = result.rows[0];

    if (!row || row.status !== 'active') {
      res.status(401).json({
        success: false,
        message: 'Invalid user',
        errors: { auth: 'No active user for x-user-id' },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.user = {
      id: row.id,
      role: row.role,
      university_id: row.university_id,
      email: row.email,
    };
    next();
  } catch (error) {
    next(error);
  }
};
