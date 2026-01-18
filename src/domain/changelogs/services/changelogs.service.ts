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
import * as changelogsModel from '../models/changelogs.model';
import {
  Changelog,
  ChangelogFilters,
} from '../types/changelogs.types';

/**
 * Get changelog by ID
 * 
 * @param id - Changelog UUID
 * @returns Changelog record
 * @throws AppError if not found
 */
export const getById = async (id: string): Promise<Changelog> => {
  const changelog = await changelogsModel.findById(id);

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
  order: 'asc' | 'desc'
): Promise<{ changelogs: Changelog[]; total: number }> => {
  // Get changelogs and total count
  const [changelogs, total] = await Promise.all([
    changelogsModel.findByAdmissionId(admissionId, page, limit, sort, order),
    changelogsModel.countByAdmissionId(admissionId),
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
  order: 'asc' | 'desc'
): Promise<{ changelogs: Changelog[]; total: number }> => {
  // Get changelogs and total count
  const [changelogs, total] = await Promise.all([
    changelogsModel.findMany(filters, page, limit, sort, order),
    changelogsModel.count(filters),
  ]);

  return { changelogs, total };
};
