/**
 * PDF upload middleware (in-memory, PDF only). Size limit: UPLOAD_MAX_MB
 * (10 MB by default, 4 MB on Vercel, which rejects bodies over 4.5 MB).
 */

import multer from 'multer';
import { AppError } from '@shared/middleware/errorHandler';
import { config } from '@config/config';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploadMaxMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new AppError('Only PDF files are allowed', 400, true, { file: 'Only PDF files are allowed' }));
    }
  },
});
