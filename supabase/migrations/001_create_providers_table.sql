-- Create providers table
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access for providers)
CREATE POLICY "Providers are publicly readable" ON public.providers
  FOR SELECT USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS providers_name_idx ON public.providers(name);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_providers_updated_at 
  BEFORE UPDATE ON public.providers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
