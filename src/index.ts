/**
 * Server bootstrap: database, HTTP server, background jobs, graceful shutdown.
 */

import '@shared/types/express';
import { networkInterfaces } from 'os';
import { config } from '@config/config';
import { initializePool, testConnection, closePool } from '@db/connection';
import { createApp } from './app';
import { initializeScheduler, stopScheduler } from '@shared/scheduler';
import { verifyEmailTransport, closeTransport } from '@domain/notifications/services/emailDelivery';
import { createLogger } from '@shared/utils/logger';

const log = createLogger('Server');

const lanHealthUrls = (port: number): string[] =>
  Object.values(networkInterfaces())
    .flatMap((addresses) => addresses ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => `http://${address.address}:${port}/health`);

const start = async (): Promise<void> => {
  initializePool();

  const dbConnected = await testConnection();
  if (!dbConnected) {
    if (config.isProduction) {
      log.error('Database unreachable at startup; refusing to start in production');
      process.exit(1);
    }
    log.warn('Database unreachable at startup; requests touching the DB will fail until it recovers');
  }

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    log.info(`Listening on ${config.host}:${config.port} (env=${config.env})`);
    if (!config.isProduction) {
      log.info(`Docs: http://localhost:${config.port}/api-docs`);
      lanHealthUrls(config.port).forEach((url) => log.info(`LAN health URL: ${url}`));
    }
    if (config.ai.enabled && !config.ai.geminiApiKey) {
      log.warn('AI is enabled but GEMINI_API_KEY is missing; /ai routes will return 503');
    }
  });

  verifyEmailTransport()
    .then((status) => {
      if (status.enabled && !status.ready) {
        log.warn(`Email transport not ready: ${status.lastVerifyError || 'unknown error'}`);
      }
    })
    .catch((error) => log.warn('Email transport check failed', (error as Error)?.message));

  if (config.scheduler.enabled) {
    initializeScheduler();
  } else {
    log.info('Scheduler disabled (SCHEDULER_ENABLED=false)');
  }

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`${signal} received, shutting down`);
    stopScheduler();
    server.close(async () => {
      await closeTransport().catch(() => undefined);
      await closePool().catch(() => undefined);
      process.exit(0);
    });
    // Force exit if connections do not drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection', reason instanceof Error ? reason.message : reason);
});

void start();
