/**
 * File Upload Middleware
 * 
 * Configures multer for PDF file uploads.
 */

import multer from 'multer';

/**
 * Multer configuration for PDF file uploads
 * 
 * - Accepts only PDF files
 * - Maximum file size: 10MB
 * - Stores file in memory as buffer
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    // Only accept PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});
