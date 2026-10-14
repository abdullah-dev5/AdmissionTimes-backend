/**
 * Configuration module
 *
 * All runtime configuration comes from environment variables. Nothing
 * project-specific (URLs, keys, project refs) is hardcoded here.
 */

import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

const normalizeUrl = (value?: string): string => (value || '').trim().replace(/\/+$/, '');

const parseIntEnv = (name: string, fallback: number): number => {
  const parsed = parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const supabaseUrl = normalizeUrl(process.env.SUPABASE_URL);
// Supabase serves auth (and its JWKS) under /auth/v1. Derive from SUPABASE_URL
// unless explicitly overridden.
const jwtIssuer = normalizeUrl(process.env.JWT_ISSUER) || (supabaseUrl ? `${supabaseUrl}/auth/v1` : '');
const jwksUrl =
  normalizeUrl(process.env.JWT_JWKS_URL) || (jwtIssuer ? `${jwtIssuer}/.well-known/jwks.json` : '');

/**
 * Application configuration object
 */
export const config = {
  port: parseIntEnv('PORT', 3000),
  host: process.env.HOST || '0.0.0.0',
  env,
  isProduction,

  apiVersion: process.env.API_VERSION || 'v1',

  /**
   * Allowed browser origins. `*` is only honoured outside production.
   */
  corsOrigins: parseList(process.env.CORS_ORIGIN),

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseIntEnv('DB_PORT', 54322),
    name: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    poolMax: parseIntEnv('DB_POOL_MAX', 20),
    /** Optional PEM CA bundle for TLS verification (e.g. Supabase root cert). */
    sslCa: process.env.DB_SSL_CA || '',
    /** Set DB_SSL_REJECT_UNAUTHORIZED=true once a CA bundle is configured. */
    sslRejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
  },

  supabase: {
    url: supabaseUrl,
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  },

  jwt: {
    issuer: jwtIssuer,
    audience: process.env.JWT_AUDIENCE || 'authenticated',
    jwksUrl,
    /** Asymmetric algorithms accepted for JWKS-signed tokens. */
    algorithms: ['ES256', 'RS256'] as const,
    clockToleranceSec: parseIntEnv('JWT_EXPIRY_TOLERANCE', 30),
  },

  /**
   * Development-only header auth (x-user-id). Off unless explicitly enabled,
   * and never available in production regardless of the flag.
   */
  devHeaderAuthEnabled: !isProduction && process.env.ALLOW_DEV_HEADER_AUTH === 'true',

  email: {
    enabled:
      process.env.EMAIL_ENABLED === 'true' ||
      (process.env.EMAIL_ENABLED !== 'false' && !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS),
    host: process.env.SMTP_HOST || '',
    port: parseIntEnv('SMTP_PORT', 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
  },

  realtime: {
    enabled:
      process.env.REALTIME_ENABLED === 'true' ||
      (process.env.REALTIME_ENABLED !== 'false' && !!supabaseUrl && !!process.env.SUPABASE_SERVICE_ROLE_KEY),
  },

  push: {
    enabled: process.env.PUSH_NOTIFICATIONS_ENABLED !== 'false',
  },

  /** Public base URL of the web app, used for links in emails. */
  webAppUrl: normalizeUrl(process.env.WEB_APP_URL),

  ai: {
    enabled: process.env.AI_ENABLED === 'true' || (!!process.env.GEMINI_API_KEY && process.env.AI_ENABLED !== 'false'),
    provider: process.env.AI_PROVIDER || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
    geminiBaseUrl: normalizeUrl(process.env.GEMINI_BASE_URL) || 'https://generativelanguage.googleapis.com/v1beta',
    timeoutMs: parseIntEnv('AI_TIMEOUT_MS', 12000),
    maxInputChars: parseIntEnv('AI_MAX_INPUT_CHARS', 16000),
  },

  scraperIntegration: {
    enabled: process.env.SCRAPER_INTEGRATION_ENABLED === 'true',
    publishEnabled: process.env.SCRAPER_PUBLISH_ENABLED === 'true',
    internalServiceToken: process.env.SCRAPER_INTERNAL_SERVICE_TOKEN || '',
  },

  scheduler: {
    /** Run cron jobs in this process. Disable on extra API replicas. */
    enabled: process.env.SCHEDULER_ENABLED !== 'false',
  },
};

/**
 * Validates required environment variables. Fails fast so a misconfigured
 * deployment never boots into a half-working (or insecure) state.
 */
export const validateConfig = (): void => {
  const missing: string[] = [];
  const problems: string[] = [];

  ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SUPABASE_URL'].forEach((name) => {
    if (!process.env[name]) missing.push(name);
  });

  if (isProduction) {
    ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'CORS_ORIGIN'].forEach((name) => {
      if (!process.env[name]) missing.push(name);
    });

    if (config.corsOrigins.includes('*')) {
      problems.push('CORS_ORIGIN must list explicit origins in production (not "*")');
    }
  }

  if (config.jwt.jwksUrl && !/\/auth\/v1\/\.well-known\/jwks\.json$/.test(config.jwt.jwksUrl)) {
    problems.push(
      `JWT_JWKS_URL looks wrong (${config.jwt.jwksUrl}). Supabase serves it at <SUPABASE_URL>/auth/v1/.well-known/jwks.json — remove JWT_JWKS_URL to derive it automatically.`
    );
  }

  if (missing.length > 0 || problems.length > 0) {
    const lines = [
      ...(missing.length ? [`Missing required environment variables: ${missing.join(', ')}`] : []),
      ...problems,
      'Check your .env against .env.example',
    ];
    throw new Error(lines.join('\n'));
  }
};

validateConfig();
