-- Extend activity_type enum to match currently supported backend activity constants.
-- Safe to run multiple times due to IF NOT EXISTS checks.

ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'alert';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'saved';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'deadline';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'notification';
