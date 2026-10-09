/**
 * Admin Domain - Controllers (all routes are behind adminOnly)
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import { parsePagination, calculatePagination } from '@shared/utils/pagination';
import * as adminService from '../services/admin.service';
import {
  AdminVerifyAdmissionDTO,
  AdminRevisionRequestDTO,
  AdminBulkVerifyDTO,
  AdminCreateUniversityRepDTO,
  AdminFilterParams,
  UserContext,
} from '../types/admin.types';

const pageParams = (params: AdminFilterParams) => {
  const { page, limit } = parsePagination({ page: params.page, limit: params.limit });
  return { page, limit, offset: (page - 1) * limit };
};

export const getPendingAdmissions = async (req: Request, res: Response): Promise<void> => {
  const params = req.validated as AdminFilterParams;
  const { page, limit, offset } = pageParams(params);
  const { data, total } = await adminService.getPendingAdmissions(params, limit, offset);
  sendPaginated(res, data, calculatePagination(total, page, limit), 'Pending admissions retrieved successfully');
};

export const getAllAdmissions = async (req: Request, res: Response): Promise<void> => {
  const params = req.validated as AdminFilterParams;
  const { page, limit, offset } = pageParams(params);
  const { data, total } = await adminService.getAllAdmissions(params, limit, offset);
  sendPaginated(res, data, calculatePagination(total, page, limit), 'Admissions retrieved successfully');
};

export const getAdmissionDetails = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await adminService.getAdmissionDetails(req.params.id), 'Admission details retrieved successfully');
};

export const verifyAdmission = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as AdminVerifyAdmissionDTO;
  const admission = await adminService.verifyAdmission(req.params.id, data, req.user as UserContext);
  sendSuccess(res, admission, data.verification_status === 'rejected' ? 'Admission rejected successfully' : 'Admission verified successfully');
};

export const requestRevision = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as AdminRevisionRequestDTO;
  const admission = await adminService.requestRevision(req.params.id, data.reason, req.user as UserContext);
  sendSuccess(res, admission, 'Revision requested successfully');
};

export const bulkVerifyAdmissions = async (req: Request, res: Response): Promise<void> => {
  const result = await adminService.bulkVerifyAdmissions(req.validated as AdminBulkVerifyDTO, req.user as UserContext);
  sendSuccess(res, result, `Bulk verification completed: ${result.succeeded.length} succeeded, ${result.failed.length} failed`);
};

export const getAdminDashboard = async (_req: Request, res: Response): Promise<void> => {
  sendSuccess(res, await adminService.getAdminDashboard(), 'Admin dashboard retrieved successfully');
};

export const createUniversityRep = async (req: Request, res: Response): Promise<void> => {
  const result = await adminService.createUniversityRep(req.validated as AdminCreateUniversityRepDTO, req.user as UserContext);
  sendSuccess(res, result, 'University representative created successfully', 201);
};
