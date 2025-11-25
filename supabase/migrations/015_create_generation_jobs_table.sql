-- Create table for tracking AI image generation jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Input parameters
  prompt TEXT NOT NULL,
  expanded_prompt TEXT,
  style TEXT,
  franchise TEXT,
  width INTEGER DEFAULT 1664,
  height INTEGER DEFAULT 928,
  seed INTEGER,
  
  -- Job status
  status TEXT NOT NULL DEFAULT 'queued',
  -- Status values: 'queued', 'processing', 'completed', 'failed'
  
  -- Output
  result_url TEXT,
  image_data BYTEA, -- Optional: store small images directly
  error_message TEXT,
  
  -- Metadata
  modal_call_id TEXT, -- Track Modal function call
  processing_time_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_created_at ON generation_jobs(created_at DESC);
CREATE INDEX idx_generation_jobs_user_status ON generation_jobs(user_id, status);

-- RLS Policies
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own generation jobs"
  ON generation_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own jobs
CREATE POLICY "Users can create own generation jobs"
  ON generation_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (for retries, etc.)
CREATE POLICY "Users can update own generation jobs"
  ON generation_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_generation_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_generation_jobs_updated_at();

-- Note: Images are stored in Backblaze B2, not Supabase Storage
-- B2 configuration is handled via environment variables

