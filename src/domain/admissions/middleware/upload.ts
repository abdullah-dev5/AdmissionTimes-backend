/**
 * PDF upload middleware (in-memory, 10MB, PDF only).
 */

import multer from 'multer';
import { AppError } from '@shared/middleware/errorHandler';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new AppError('Only PDF files are allowed', 400, true, { file: 'Only PDF files are allowed' }));
    }
  },
});
