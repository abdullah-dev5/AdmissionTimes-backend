-- Migration: Rename organization_id to university_id in users table
-- Purpose: Align column naming with admissions.university_id for consistency
-- Date: 2026-02-25

BEGIN;

-- 1) Rename the column in users table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'organization_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'university_id'
  ) THEN
    ALTER TABLE users RENAME COLUMN organization_id TO university_id;
  END IF;
END $$;

-- 2) Update the foreign key constraint name to match new column name
-- Drop old constraint
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS fk_users_organization_id;

-- Add new constraint with updated name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'university_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND constraint_name = 'fk_users_university_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_university_id
      FOREIGN KEY (university_id)
      REFERENCES universities(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Rename any indexes referencing organization_id (if they exist)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_users_organization_id'
  ) THEN
    ALTER INDEX idx_users_organization_id RENAME TO idx_users_university_id;
  END IF;
END $$;

-- 4) Update the trigger function for university_id assignment (if needed)
-- The create_university_for_user trigger should now reference university_id instead of organization_id
-- This may need manual verification, as the trigger creation isn't in our migrations yet

-- 5) Comments for documentation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'university_id'
  ) THEN
    COMMENT ON COLUMN users.university_id IS 'Foreign key to universities table. Only populated for university role users.';
    RAISE NOTICE 'Migration successful: users.university_id is present';
  ELSE
    RAISE EXCEPTION 'Migration failed: users.university_id not found after rename step';
  END IF;
END $$;

COMMIT;
