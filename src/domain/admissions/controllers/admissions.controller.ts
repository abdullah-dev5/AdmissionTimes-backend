/**
 * Admissions Domain - Controllers (HTTP only; rules live in the services)
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '@shared/utils/response';
import { AppError } from '@shared/middleware/errorHandler';
import { calculatePagination, parsePagination } from '@shared/utils/pagination';
import * as admissionsService from '../services/admissions.service';
import { parsePDFAndExtract } from '../services/pdf.service';
import * as moderationService from '@domain/admin/services/admin.service';
import { getByAdmissionId } from '@domain/deadlines/services/deadlines.service';
import {
  CreateAdmissionDTO,
  UpdateAdmissionDTO,
  RejectAdmissionDTO,
  VerifyAdmissionDTO,
  AdmissionQueryParams,
} from '../types/admissions.types';
import type { AuthenticatedUserContext } from '@shared/types/auth';

const PDF_MAGIC = Buffer.from('%PDF-');

export const getAdmission = async (req: Request, res: Response): Promise<void> => {
  const admission = await admissionsService.getById(req.params.id, req.user);
  sendSuccess(res, admission, 'Admission retrieved successfully');
};

export const getAdmissions = async (req: Request, res: Response): Promise<void> => {
  const params = req.validated as AdmissionQueryParams;
  const { page, limit } = parsePagination({ page: params.page, limit: params.limit });
  const { admissions, total } = await admissionsService.getMany(params, page, limit, req.user);
  sendPaginated(res, admissions, calculatePagination(total, page, limit));
};

export const createAdmission = async (req: Request, res: Response): Promise<void> => {
  const admission = await admissionsService.create(req.validated as CreateAdmissionDTO, req.user);
  sendSuccess(res, admission, 'Admission created successfully', 201);
};

export const updateAdmission = async (req: Request, res: Response): Promise<void> => {
  const admission = await admissionsService.update(req.params.id, req.validated as UpdateAdmissionDTO, req.user);
  sendSuccess(res, admission, 'Admission updated successfully');
};

export const submitAdmission = async (req: Request, res: Response): Promise<void> => {
  const admission = await admissionsService.submit(req.params.id, req.user);
  sendSuccess(res, admission, 'Admission submitted for verification');
};

/** Legacy alias for POST /admin/admissions/:id/verify (admin-only route). */
export const verifyAdmission = async (req: Request, res: Response): Promise<void> => {
  const data = (req.validated || {}) as VerifyAdmissionDTO;
  const admission = await moderationService.verifyAdmission(
    req.params.id,
    { verification_status: 'verified', admin_notes: data.notes || undefined },
    req.user as AuthenticatedUserContext
  );
  sendSuccess(res, admission, 'Admission verified successfully');
};

/** Legacy alias for POST /admin/admissions/:id/verify with status=rejected. */
export const rejectAdmission = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as RejectAdmissionDTO;
  const admission = await moderationService.verifyAdmission(
    req.params.id,
    { verification_status: 'rejected', rejection_reason: data.rejection_reason },
    req.user as AuthenticatedUserContext
  );
  sendSuccess(res, admission, 'Admission rejected successfully');
};

export const deleteAdmission = async (req: Request, res: Response): Promise<void> => {
  const admission = await admissionsService.remove(req.params.id, req.user);
  sendSuccess(res, admission, 'Admission deleted successfully');
};

export const getChangelogs = async (req: Request, res: Response): Promise<void> => {
  const { page, limit } = parsePagination({
    page: Number(req.query.page) || undefined,
    limit: Number(req.query.limit) || undefined,
  });
  const { changelogs, total } = await admissionsService.getChangelogs(req.params.id, page, limit, req.user);
  sendPaginated(res, changelogs, calculatePagination(total, page, limit));
};

export const getAdmissionDeadlines = async (req: Request, res: Response): Promise<void> => {
  // Same visibility rules as the admission itself.
  await admissionsService.getById(req.params.id, req.user);
  const deadlines = await getByAdmissionId(req.params.id);
  sendSuccess(res, deadlines, 'Deadlines retrieved successfully');
};

export const parsePDF = async (req: Request, res: Response): Promise<void> => {
  const file = req.file;
  if (!file) {
    throw new AppError('PDF file is required', 400, true, { file: 'PDF file is required' });
  }
  if (!file.buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new AppError('Uploaded file is not a valid PDF', 400, true, { file: 'Not a PDF document' });
  }
  const extractedData = await parsePDFAndExtract(file.buffer);
  sendSuccess(res, extractedData, 'PDF parsed successfully');
};
