/**
 * Changelogs Domain - Controller Layer
 * 
 * HTTP request/response handlers for changelogs endpoints.
 * 
 * Responsibilities:
 * - Extract request data (body, params, query)
 * - Call service methods
 * - Format responses using sendSuccess(), sendError(), sendPaginated()
 * - Set appropriate HTTP status codes
 * - Handle async errors with try-catch
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import * as changelogsService from '../services/changelogs.service';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import {
  ChangelogQueryParams,
} from '../types/changelogs.types';

interface UserContextLike {
  id: string;
  role: 'admin' | 'student' | 'university' | 'guest';
  university_id?: string | null;
}

/**
 * Get changelog by ID
 * 
 * GET /api/v1/changelogs/:id
 */
export const getChangelog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContextLike | undefined;

    const changelog = await changelogsService.getById(id, userContext);

    sendSuccess(res, changelog, 'Changelog retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get changelogs by admission ID
 * 
 * GET /api/v1/changelogs/admission/:admissionId
 */
export const getChangelogsByAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { admissionId } = req.params;
    const queryParams = req.query as any;
    const userContext = req.user as UserContextLike | undefined;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract sort and order
    const sort = queryParams.sort || 'created_at';
    const order = (queryParams.order || 'desc') as 'asc' | 'desc';

    // Get changelogs
    const { changelogs, total } = await changelogsService.getByAdmissionId(
      admissionId,
      page,
      limit,
      sort,
      order,
      userContext
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, changelogs, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple changelogs with filters and pagination
 * 
 * GET /api/v1/changelogs
 */
export const getChangelogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as ChangelogQueryParams;
    const userContext = req.user as UserContextLike | undefined;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract filters
    const filters = {
      admission_id: queryParams.admission_id,
      actor_type: queryParams.actor_type,
      action_type: queryParams.action_type,
      changed_by: queryParams.changed_by,
      date_from: queryParams.date_from,
      date_to: queryParams.date_to,
      search: queryParams.search,
    };

    // Extract sort and order
    const sort = queryParams.sort || 'created_at';
    const order = queryParams.order || 'desc';

    // Get changelogs
    const { changelogs, total } = await changelogsService.getMany(
      filters,
      page,
      limit,
      sort,
      order,
      userContext
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, changelogs, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};
