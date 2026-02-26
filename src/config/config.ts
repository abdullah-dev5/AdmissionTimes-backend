/**
 * Configuration module
 * 
 * Handles all application configuration including environment variables,
 * database settings, and other configurable values.
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration object
 */
export const config = {
  // Server configuration
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  
  // API configuration
  apiVersion: process.env.API_VERSION || 'v1',
  
  // CORS configuration
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  // Database configuration
  // Supports: Supabase Local, Supabase Cloud (direct), Supabase Cloud (pooling)
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '54322', 10),
    name: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    // Pool size: Match your Supabase plan limit (Nano=15, Pro=60, Team=120)
    // Setting higher than plan limit will cause connection errors
    poolMax: parseInt(process.env.DB_POOL_MAX || '20', 10),
  },
  
  // Supabase Auth configuration (Phase 1: JWKS Verification)
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  },
  
  // JWT configuration (Phase 1: JWKS Signature Verification)
  jwt: {
    algorithm: process.env.JWT_ALGORITHM || 'RS256',
    issuer: process.env.JWT_ISSUER || 'https://lufhgsgubvxjrrcsevte.supabase.co/auth/v1',
    audience: process.env.JWT_AUDIENCE || 'authenticated',
    jwksUrl: process.env.JWT_JWKS_URL || 'https://lufhgsgubvxjrrcsevte.supabase.co/.well-known/jwks.json',
    expiryTolerance: parseInt(process.env.JWT_EXPIRY_TOLERANCE || '300', 10),
  },

  // Email configuration (Phase 2: Nodemailer SMTP)
  email: {
    enabled:
      process.env.EMAIL_ENABLED === 'true' ||
      (process.env.EMAIL_ENABLED !== 'false' && !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS),
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'admissiontimes@gmail.com',
  },

  // Realtime configuration (Phase 2: Supabase Realtime)
  realtime: {
    enabled:
      process.env.REALTIME_ENABLED === 'true' ||
      (process.env.REALTIME_ENABLED !== 'false' && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY),
  },
};

/**
 * Validates that all required environment variables are set
 */
export const validateConfig = (): void => {
  const requiredVars: string[] = [];
  
  // Core database variables (always required)
  const coreRequired = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  coreRequired.forEach(varName => {
    if (!process.env[varName]) {
      requiredVars.push(varName);
    }
  });
  
  // Supabase/JWT variables required in production
  if (process.env.NODE_ENV === 'production') {
    const prodRequired = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_JWT_SECRET',
      'JWT_ISSUER',
      'JWT_JWKS_URL',
    ];
    prodRequired.forEach(varName => {
      if (!process.env[varName]) {
        requiredVars.push(varName);
      }
    });
  }
  
  if (requiredVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${requiredVars.join(', ')}\n` +
      'Please check your .env file against env.example'
    );
  }
};

// Validate configuration on module load
validateConfig();
