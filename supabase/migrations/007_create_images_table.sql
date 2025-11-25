-- Create images table
CREATE TABLE IF NOT EXISTS public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.variants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('thumbnail', 'mockup', 'detail', 'lifestyle')),
  gender TEXT CHECK (gender IN ('male', 'female', 'unisex')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access for images)
CREATE POLICY "Images are publicly readable" ON public.images
  FOR SELECT USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS images_product_id_idx ON public.images(product_id);
CREATE INDEX IF NOT EXISTS images_variant_id_idx ON public.images(variant_id);
CREATE INDEX IF NOT EXISTS images_type_idx ON public.images(type);
CREATE INDEX IF NOT EXISTS images_gender_idx ON public.images(gender);

-- Add updated_at trigger
CREATE TRIGGER update_images_updated_at 
  BEFORE UPDATE ON public.images 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
