-- Add placement dimensions to variants table for product designer
ALTER TABLE public.variants ADD COLUMN placement_dimensions JSONB;

-- Add index for placement dimensions queries
CREATE INDEX idx_variants_placement_dimensions ON public.variants USING GIN (placement_dimensions);
