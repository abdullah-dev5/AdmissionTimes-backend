/**
 * Express application factory.
 *
 * Kept separate from the server bootstrap (index.ts) so tests can build the
 * full middleware stack without opening a port or starting cron jobs.
 */

import '@shared/types/express';
import express, { Application, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import swaggerUi from 'swagger-ui-express';
import { config } from '@config/config';
import { errorHandler } from '@shared/middleware/errorHandler';
import { sendSuccess, sendError } from '@shared/utils/response';
import { testConnection } from '@db/connection';
import { apiAuth } from '@shared/middleware/apiAuth';
import { registerDomains } from '@domain/index';
import { swaggerSpec } from '@config/swagger';
import authRoutes from '@domain/auth/routes/auth.routes';

const API_PREFIX = `/api/${config.apiVersion}`;

const buildCorsOptions = (): CorsOptions => {
  const origins = config.corsOrigins;
  const allowAll = !config.isProduction && (origins.length === 0 || origins.includes('*'));

  return {
    origin: allowAll ? true : origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', ...(config.devHeaderAuthEnabled ? ['x-user-id'] : [])],
    exposedHeaders: ['x-total-count', 'x-page', 'x-per-page', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  };
};

/** Baseline security headers (subset of what helmet sets for a JSON API). */
const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
};

export const createApp = (): Application => {
  const app = express();

  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
  }

  app.use(securityHeaders);
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // API docs: always in development, opt-in elsewhere.
  if (!config.isProduction || process.env.SWAGGER_ENABLED === 'true') {
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'AdmissionTimes API Documentation',
      })
    );
  }

  /** Liveness + readiness: reports 503 when the database is unreachable. */
  app.get('/health', async (_req: Request, res: Response) => {
    const database = await testConnection();
    if (!database) {
      sendError(res, 'Database unavailable', 503, { database: 'unreachable' });
      return;
    }
    sendSuccess(res, { status: 'ok', database: 'ok', environment: config.env });
  });

  // Public auth routes. Credential endpoints are rate limited per IP inside
  // the auth router; GET /auth/me (called on every page load) is not.
  app.use(`${API_PREFIX}/auth`, authRoutes);

  // Everything else under the API requires authentication, except the
  // internal scraper routes which use their own service token.
  app.use(API_PREFIX, (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/internal/scraper')) {
      next();
      return;
    }
    apiAuth(req, res, next);
  });

  registerDomains(app);

  app.use((req: Request, res: Response) => {
    sendError(res, 'Route not found', 404, { path: req.originalUrl });
  });

  app.use(errorHandler);

  return app;
};
