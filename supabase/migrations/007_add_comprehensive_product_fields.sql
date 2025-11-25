-- Add comprehensive product fields from Printful v2 API
ALTER TABLE public.products ADD COLUMN printful_id INTEGER;
ALTER TABLE public.products ADD COLUMN type TEXT;
ALTER TABLE public.products ADD COLUMN brand TEXT;
ALTER TABLE public.products ADD COLUMN model TEXT;
ALTER TABLE public.products ADD COLUMN variant_count INTEGER;
ALTER TABLE public.products ADD COLUMN is_discontinued BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN sizes JSONB;
ALTER TABLE public.products ADD COLUMN colors JSONB;
ALTER TABLE public.products ADD COLUMN placements JSONB;
ALTER TABLE public.products ADD COLUMN product_options JSONB;

-- Add index on printful_id for faster lookups
CREATE INDEX idx_products_printful_id ON public.products(printful_id);

-- Add index on type for filtering
CREATE INDEX idx_products_type ON public.products(type);

-- Add index on brand for filtering
CREATE INDEX idx_products_brand ON public.products(brand);
