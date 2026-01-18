-- Create watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admission_id UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one watchlist entry per user-admission pair
  UNIQUE(user_id, admission_id)
);

-- Create indexes
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_admission_id ON watchlists(admission_id);
CREATE INDEX idx_watchlists_created_at ON watchlists(created_at DESC);

-- Add comments
COMMENT ON TABLE watchlists IS 'User watchlists for tracking admissions of interest';
COMMENT ON COLUMN watchlists.user_id IS 'User who added to watchlist';
COMMENT ON COLUMN watchlists.admission_id IS 'Admission being watched';
COMMENT ON COLUMN watchlists.notes IS 'Optional user notes about this admission';
