-- Add mockup styles table for product designer
CREATE TABLE public.mockup_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  placement TEXT NOT NULL,
  technique TEXT NOT NULL,
  print_area_width DECIMAL,
  print_area_height DECIMAL,
  print_area_type TEXT,
  dpi INTEGER,
  style_id INTEGER NOT NULL,
  category_name TEXT NOT NULL,
  view_name TEXT NOT NULL,
  restricted_to_variants JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX idx_mockup_styles_product_placement ON public.mockup_styles(product_id, placement);
CREATE INDEX idx_mockup_styles_category ON public.mockup_styles(category_name);
CREATE INDEX idx_mockup_styles_style_id ON public.mockup_styles(style_id);
CREATE INDEX idx_mockup_styles_placement_category ON public.mockup_styles(placement, category_name);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_mockup_styles_unique ON public.mockup_styles(product_id, placement, style_id);
