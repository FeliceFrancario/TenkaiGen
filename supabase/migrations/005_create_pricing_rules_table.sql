-- Create pricing_rules table
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  markup_type TEXT NOT NULL CHECK (markup_type IN ('percentage', 'fixed')),
  markup_value NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL,
  retail_price NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access for pricing rules)
CREATE POLICY "Pricing rules are publicly readable" ON public.pricing_rules
  FOR SELECT USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS pricing_rules_product_id_idx ON public.pricing_rules(product_id);
CREATE INDEX IF NOT EXISTS pricing_rules_currency_idx ON public.pricing_rules(currency);

-- Add updated_at trigger
CREATE TRIGGER update_pricing_rules_updated_at 
  BEFORE UPDATE ON public.pricing_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
