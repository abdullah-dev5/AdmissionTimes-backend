/**
 * Admissions Domain - Controller Layer
 * 
 * HTTP request/response handlers for admissions endpoints.
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
import * as admissionsService from '../services/admissions.service';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import {
  CreateAdmissionDTO,
  UpdateAdmissionDTO,
  VerifyAdmissionDTO,
  RejectAdmissionDTO,
  SubmitAdmissionDTO,
  DisputeAdmissionDTO,
  AdmissionQueryParams,
  UserContext,
} from '../types/admissions.types';

/**
 * Get single admission by ID
 * 
 * GET /api/v1/admissions/:id
 */
export const getAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userContext = req.user as UserContext | undefined;

    const admission = await admissionsService.getById(id, userContext);

    sendSuccess(res, admission, 'Admission retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get multiple admissions with filters and pagination
 * 
 * GET /api/v1/admissions
 */
export const getAdmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as AdmissionQueryParams;
    const userContext = req.user as UserContext | undefined;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Extract filters
    const filters = {
      search: queryParams.search,
      program_type: queryParams.program_type,
      degree_level: queryParams.degree_level,
      field_of_study: queryParams.field_of_study,
      location: queryParams.location,
      delivery_mode: queryParams.delivery_mode,
      verification_status: queryParams.verification_status,
      created_by: queryParams.created_by,
    };

    // Extract sort and order
    const sort = queryParams.sort || 'created_at';
    const order = queryParams.order || 'desc';

    // Get admissions
    const { admissions, total } = await admissionsService.getMany(
      filters,
      page,
      limit,
      sort,
      order,
      userContext
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, admissions, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new admission
 * 
 * POST /api/v1/admissions
 */
export const createAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.validated as CreateAdmissionDTO;
    const userContext = req.user as UserContext | undefined;

    const admission = await admissionsService.create(data, userContext);

    sendSuccess(res, admission, 'Admission created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing admission
 * 
 * PUT /api/v1/admissions/:id
 */
export const updateAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as UpdateAdmissionDTO;
    const userContext = req.user as UserContext | undefined;

    const admission = await admissionsService.update(id, data, userContext);

    sendSuccess(res, admission, 'Admission updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Verify an admission (admin only)
 * 
 * PATCH /api/v1/admissions/:id/verify
 */
export const verifyAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as VerifyAdmissionDTO;
    const userContext = req.user as UserContext | undefined;

    const admission = await admissionsService.verify(id, data, userContext);

    sendSuccess(res, admission, 'Admission verified successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Reject an admission (admin only)
 * 
 * PATCH /api/v1/admissions/:id/reject
 */
export const rejectAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as RejectAdmissionDTO;
    const userContext = req.user as UserContext | undefined;

    const admission = await admissionsService.reject(id, data, userContext);

    sendSuccess(res, admission, 'Admission rejected successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Submit an admission (university - moves draft to pending)
 * 
 * PATCH /api/v1/admissions/:id/submit
 */
export const submitAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as SubmitAdmissionDTO;
    const userContext = req.user as UserContext | undefined;

    const admission = await admissionsService.submit(id, data, userContext);

    sendSuccess(res, admission, 'Admission submitted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Dispute a rejected admission (university - moves rejected to disputed)
 * 
 * PATCH /api/v1/admissions/:id/dispute
 */
export const disputeAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as DisputeAdmissionDTO;
    const userContext = req.user as UserContext | undefined;

    const admission = await admissionsService.dispute(id, data, userContext);

    sendSuccess(res, admission, 'Admission disputed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get changelogs for an admission
 * 
 * GET /api/v1/admissions/:id/changelogs
 */
export const getChangelogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const queryParams = req.query as { page?: number; limit?: number };

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Get changelogs
    const { changelogs, total } = await admissionsService.getChangelogs(id, page, limit);

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, changelogs, pagination, 'Success');
  } catch (error) {
    next(error);
  }
};
