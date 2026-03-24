/**
 * Changelogs Domain - Service Layer
 * 
 * Business logic and orchestration for changelogs.
 * 
 * Responsibilities:
 * - Implement business rules
 * - Coordinate between model and other services
 * - Validate business rules
 * 
 * NO HTTP concerns - that belongs in the controller layer.
 */

import { AppError } from '@shared/middleware/errorHandler';
import { query } from '@db/connection';
import * as changelogsModel from '../models/changelogs.model';
import {
  Changelog,
  ChangelogFilters,
} from '../types/changelogs.types';

interface UserContextLike {
  id: string;
  role: 'admin' | 'student' | 'university' | 'guest';
  university_id?: string | null;
}

const resolveUniversityScopeId = async (userContext: UserContextLike): Promise<string | null> => {
  if (userContext.university_id) {
    return userContext.university_id;
  }

  const result = await query(
    'SELECT university_id::text as university_id FROM users WHERE id = $1 LIMIT 1',
    [userContext.id]
  );

  return result.rows[0]?.university_id || null;
};

const resolveViewerScope = async (
  userContext?: UserContextLike
): Promise<{ role: 'admin' | 'university'; universityId?: string }> => {
  if (!userContext || userContext.role === 'guest' || userContext.role === 'student') {
    throw new AppError('Forbidden: changelog access is restricted', 403);
  }

  if (userContext.role === 'admin') {
    return { role: 'admin' };
  }

  const universityId = await resolveUniversityScopeId(userContext);
  if (!universityId) {
    throw new AppError('Forbidden: university scope is missing', 403);
  }

  return { role: 'university', universityId };
};

/**
 * Get changelog by ID
 * 
 * @param id - Changelog UUID
 * @returns Changelog record
 * @throws AppError if not found
 */
export const getById = async (
  id: string,
  userContext?: UserContextLike
): Promise<Changelog> => {
  const scope = await resolveViewerScope(userContext);
  const changelog = await changelogsModel.findById(id, scope);

  if (!changelog) {
    throw new AppError('Changelog not found', 404);
  }

  return changelog;
};

/**
 * Get changelogs by admission ID
 * 
 * @param admissionId - Admission UUID
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @returns Object with changelogs array and total count
 */
export const getByAdmissionId = async (
  admissionId: string,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc',
  userContext?: UserContextLike
): Promise<{ changelogs: Changelog[]; total: number }> => {
  const scope = await resolveViewerScope(userContext);

  // Get changelogs and total count
  const [changelogs, total] = await Promise.all([
    changelogsModel.findByAdmissionId(admissionId, page, limit, sort, order, scope),
    changelogsModel.countByAdmissionId(admissionId, scope),
  ]);

  return { changelogs, total };
};

/**
 * Get multiple changelogs with filters and pagination
 * 
 * @param filters - Filter criteria
 * @param page - Page number
 * @param limit - Items per page
 * @param sort - Sort field
 * @param order - Sort order
 * @returns Object with changelogs array and total count
 */
export const getMany = async (
  filters: ChangelogFilters,
  page: number,
  limit: number,
  sort: string,
  order: 'asc' | 'desc',
  userContext?: UserContextLike
): Promise<{ changelogs: Changelog[]; total: number }> => {
  const scope = await resolveViewerScope(userContext);

  // Get changelogs and total count
  const [changelogs, total] = await Promise.all([
    changelogsModel.findMany(filters, page, limit, sort, order, scope),
    changelogsModel.count(filters, scope),
  ]);

  return { changelogs, total };
};
