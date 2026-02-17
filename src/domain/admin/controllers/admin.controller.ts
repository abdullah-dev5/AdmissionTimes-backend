/**
 * Admin Domain - Controller Layer
 * 
 * HTTP request/response handlers for admin endpoints.
 * 
 * Responsibilities:
 * - Extract request data (body, params, query)
 * - Call service methods
 * - Format responses using sendSuccess(), sendPaginated()
 * - Set appropriate HTTP status codes
 * - Handle async errors with try-catch
 * 
 * NO business logic - that belongs in the service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import * as adminService from '../services/admin.service';
import { parsePagination, calculatePagination } from '@shared/utils/pagination';
import {
  AdminVerifyAdmissionDTO,
  AdminBulkVerifyDTO,
  AdminFilterParams,
  UserContext,
} from '../types/admin.types';

/**
 * Get pending admissions
 * 
 * GET /api/v1/admin/admissions/pending
 */
export const getPendingAdmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as AdminFilterParams;

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get pending admissions
    const { data, total } = await adminService.getPendingAdmissions(
      limit,
      offset
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, data, pagination, 'Pending admissions retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get all admissions with optional status filter
 * 
 * GET /api/v1/admin/admissions
 */
export const getAllAdmissions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queryParams = req.validated as AdminFilterParams & { status?: string };

    // Parse pagination
    const { page, limit } = parsePagination({
      page: queryParams.page,
      limit: queryParams.limit,
    });

    // Calculate offset
    const offset = (page - 1) * limit;

    // Get all admissions with optional status filter
    const { data, total } = await adminService.getAllAdmissions(
      limit,
      offset,
      queryParams.status
    );

    // Calculate pagination metadata
    const pagination = calculatePagination(total, page, limit);

    sendPaginated(res, data, pagination, 'Admissions retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get admission details
 * 
 * GET /api/v1/admin/admissions/:id
 */
export const getAdmissionDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const admission = await adminService.getAdmissionDetails(id);

    sendSuccess(res, admission, 'Admission details retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Verify a single admission
 * 
 * POST /api/v1/admin/admissions/:id/verify
 */
export const verifyAdmission = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.validated as AdminVerifyAdmissionDTO;
    const userContext = (req.user as UserContext | undefined)!;

    const admission = await adminService.verifyAdmission(
      id,
      data,
      userContext
    );

    sendSuccess(res, admission, 'Admission verified successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk verify admissions
 * 
 * POST /api/v1/admin/admissions/bulk-verify
 */
export const bulkVerifyAdmissions = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const req = _req as any;
    const data = req.validated as AdminBulkVerifyDTO;
    const userContext = (req.user as UserContext | undefined)!;

    const result = await adminService.bulkVerifyAdmissions(data, userContext);

    sendSuccess(res, result, 'Bulk verification completed', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get admin dashboard
 * 
 * GET /api/v1/admin/dashboard
 */
export const getAdminDashboard = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dashboard = await adminService.getAdminDashboard();

    sendSuccess(res, dashboard, 'Admin dashboard retrieved successfully');
  } catch (error) {
    next(error);
  }
};
