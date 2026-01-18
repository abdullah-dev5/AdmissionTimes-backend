-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Email preferences
  email_notifications_enabled BOOLEAN DEFAULT true,
  email_frequency VARCHAR(20) DEFAULT 'immediate' CHECK (email_frequency IN ('immediate', 'daily', 'weekly', 'never')),
  
  -- Push notification preferences
  push_notifications_enabled BOOLEAN DEFAULT true,
  
  -- Notification category preferences (JSONB for flexibility)
  notification_categories JSONB DEFAULT '{
    "verification": true,
    "deadline": true,
    "system": true,
    "update": true
  }'::jsonb,
  
  -- Localization preferences
  language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'ar', 'fr', 'es')),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- UI preferences (future use)
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Add comments
COMMENT ON TABLE user_preferences IS 'User preferences for notifications, localization, and UI';
COMMENT ON COLUMN user_preferences.email_frequency IS 'How often to send email notifications';
COMMENT ON COLUMN user_preferences.notification_categories IS 'JSON object with category-specific preferences';
