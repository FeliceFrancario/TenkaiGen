-- Seed Printful provider
INSERT INTO public.providers (name, api_base_url) 
VALUES ('Printful', 'https://api.printful.com')
ON CONFLICT DO NOTHING;

-- Seed default exchange rates (these will be updated by cron job)
INSERT INTO public.exchange_rates (currency, rate_to_usd) VALUES
  ('USD', 1.0),
  ('EUR', 0.85),
  ('GBP', 0.75),
  ('CAD', 1.35),
  ('AUD', 1.50),
  ('JPY', 110.0),
  ('BRL', 5.20),
  ('KRW', 1200.0),
  ('NZD', 1.60)
ON CONFLICT (currency) DO UPDATE SET
  rate_to_usd = EXCLUDED.rate_to_usd,
  last_updated = NOW();
