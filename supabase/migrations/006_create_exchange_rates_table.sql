-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency TEXT NOT NULL UNIQUE,
  rate_to_usd NUMERIC(10,6) NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access for exchange rates)
CREATE POLICY "Exchange rates are publicly readable" ON public.exchange_rates
  FOR SELECT USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS exchange_rates_currency_idx ON public.exchange_rates(currency);
CREATE INDEX IF NOT EXISTS exchange_rates_last_updated_idx ON public.exchange_rates(last_updated);
