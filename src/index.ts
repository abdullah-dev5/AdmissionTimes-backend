/**
 * Main entry point for the AdmissionTimes backend application
 * 
 * This file initializes the Express server and sets up all middleware,
 * routes, and error handlers.
 */

import express, { Application, Request, Response } from 'express';
import { config } from './config/config';
import { errorHandler } from './middleware/errorHandler';
import { sendSuccess } from './utils/response';
import { initializePool, testConnection, closePool } from './database/connection';

// Initialize Express application
const app: Application = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    message: 'AdmissionTimes backend is running',
  });
});

// API routes will be added here
// app.use('/api/v1', routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: _req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Initialize database connection
initializePool();

// Start server
const PORT = config.port || 3000;

const server = app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${config.env}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Test database connection on startup
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('⚠️  Warning: Database connection test failed. Some features may not work.');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
});

export default app;
