-- Create variants table
CREATE TABLE IF NOT EXISTS public.variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT,
  size TEXT,
  color TEXT,
  image_url TEXT,
  base_price_usd NUMERIC(10,2) NOT NULL,
  stock_status TEXT DEFAULT 'in_stock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.variants ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access for variants)
CREATE POLICY "Variants are publicly readable" ON public.variants
  FOR SELECT USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS variants_product_id_idx ON public.variants(product_id);
CREATE INDEX IF NOT EXISTS variants_sku_idx ON public.variants(sku);
CREATE INDEX IF NOT EXISTS variants_size_idx ON public.variants(size);
CREATE INDEX IF NOT EXISTS variants_color_idx ON public.variants(color);

-- Add updated_at trigger
CREATE TRIGGER update_variants_updated_at 
  BEFORE UPDATE ON public.variants 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
