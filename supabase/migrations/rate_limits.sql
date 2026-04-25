-- Rate limiting table for API endpoints
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL DEFAULT 'extract-hardware',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by Edge Functions)
CREATE POLICY "Service role full access"
  ON api_rate_limits FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint_time
  ON api_rate_limits (user_id, endpoint, created_at DESC);
