-- Migration: Add Auth Columns to Users Table
-- Created: 2026-01-19
-- Description: Adds email and password columns for basic authentication
-- Phase: Basic Auth Implementation

-- Add email column (unique, for authentication)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

-- Add password column (plain text for now, will hash later)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Add comments
COMMENT ON COLUMN users.email IS 'User email address - used for authentication, must be unique';
COMMENT ON COLUMN users.password IS 'User password - plain text for development, will be hashed in production';
