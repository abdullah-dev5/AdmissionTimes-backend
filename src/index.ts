/**
 * Main entry point for the AdmissionTimes backend application
 * 
 * This file initializes the Express server and sets up all middleware,
 * routes, and error handlers.
 */

// Type augmentation for Express Request (must be at top level)
import { UserContext } from '@domain/admissions/types/admissions.types';

declare global {
  namespace Express {
    interface Request {
      /**
       * User context attached by authentication middleware
       * Populated from JWT token claims by jwtAuth middleware
       */
      user?: UserContext;
    }
  }
}

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from '@config/config';
import { errorHandler } from '@shared/middleware/errorHandler';
import { sendSuccess } from '@shared/utils/response';
import { initializePool, testConnection, closePool } from '@db/connection';
import { jwtAuth } from '@shared/middleware/jwtAuth';
import { registerDomains } from '@domain/index';
import { swaggerSpec } from '@config/swagger';
import authRoutes from '@domain/auth/routes/auth.routes';
import { initializeScheduler } from '@shared/scheduler';

// Initialize Express application
const app: Application = express();

// CORS configuration
// Allow frontend to make requests from configured origin
const corsOptions = {
  origin: config.corsOrigin === '*' 
    ? true // Allow all origins in development
    : config.corsOrigin.split(',').map(origin => origin.trim()), // Support multiple origins
  credentials: true, // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-role', 'x-university-id'],
  exposedHeaders: ['x-total-count', 'x-page', 'x-per-page'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Documentation (Swagger/OpenAPI)
// Accessible at: http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AdmissionTimes API Documentation',
  customfavIcon: '/favicon.ico',
}));

// Auth routes (public) - sign in/up must be accessible without JWT
app.use('/api/v1/auth', authRoutes);

// 🔐 REAL JWT AUTHENTICATION (Phase 4C-1)
// All other routes under /api/v1 require valid JWT token
// Health check and API docs remain public
app.use('/api/v1', jwtAuth);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Returns the health status of the API server
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Success
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     message:
 *                       type: string
 *                       example: AdmissionTimes backend is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (_req: Request, res: Response) => {
  sendSuccess(res, {
    status: 'ok',
    message: 'AdmissionTimes backend is running',
  });
});

// Register all domain routes
registerDomains(app);

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
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  
  // Test database connection on startup
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('⚠️  Warning: Database connection test failed. Some features may not work.');
  }
  
  // Initialize scheduled tasks
  initializeScheduler();
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
