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
  
  // JWT configuration (to be added when authentication is implemented)
  // jwt: {
  //   secret: process.env.JWT_SECRET || '',
  //   expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  // },
};

/**
 * Validates that all required environment variables are set
 */
export const validateConfig = (): void => {
  const requiredVars: string[] = [];
  
  // Add required environment variables here as they are needed
  // Example: if (!process.env.JWT_SECRET) requiredVars.push('JWT_SECRET');
  
  if (requiredVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${requiredVars.join(', ')}`
    );
  }
};

// Validate configuration on module load
validateConfig();
