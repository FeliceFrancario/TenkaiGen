import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignored for Server Components; middleware refresh handles sessions
          }
        },
      },
    }
  )
}

// For API routes that need service role access, we'll create a separate client
export async function createServiceClient() {
  // Use service role key for privileged writes from server-only contexts
  const isServiceKeyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  try {
    console.log(
      `[Supabase] createServiceClient using ${isServiceKeyPresent ? 'service_role' : 'publishable'} key; url present: ${Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)}`
    )
  } catch {}
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // No-op for service client
        },
      },
    }
  )
}

export type Provider = {
  id: string
  name: string
  api_base_url: string
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  provider_id: string
  name: string
  slug: string
  parent_id?: string
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  provider_id: string
  category_id: string
  name: string
  description?: string
  slug: string
  base_price_usd: number
  thumbnail_url?: string
  // Additional fields from Printful v2 API
  printful_id?: number
  type?: string
  brand?: string
  model?: string
  variant_count?: number
  is_discontinued?: boolean
  sizes?: string[]
  colors?: any[]
  techniques?: any[]
  placements?: any[]
  product_options?: any[]
  created_at: string
  updated_at: string
}

export type Variant = {
  id: string
  product_id: string
  sku?: string
  size?: string
  color?: string
  image_url?: string
  base_price_usd: number
  stock_status: string
  created_at: string
  updated_at: string
}

export type PricingRule = {
  id: string
  product_id?: string
  markup_type: 'percentage' | 'fixed'
  markup_value: number
  currency: string
  retail_price?: number
  created_at: string
  updated_at: string
}

export type ExchangeRate = {
  id: string
  currency: string
  rate_to_usd: number
  last_updated: string
}

export type Image = {
  id: string
  product_id: string
  variant_id?: string
  url: string
  type: 'thumbnail' | 'mockup' | 'detail' | 'lifestyle'
  gender?: 'male' | 'female' | 'unisex'
  created_at: string
  updated_at: string
}

export type ProductTranslation = {
  id: string
  product_id: string
  language_code: string
  title: string
  description?: string
  created_at: string
  updated_at: string
}

export type CategoryTranslation = {
  id: string
  category_id: string
  language_code: string
  title: string
  description?: string
  created_at: string
  updated_at: string
}

// Helper function to create slug from name
export function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// Helper function to get provider by name
export async function getProvider(name: string): Promise<Provider | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('name', name)
    .single()

  if (error) {
    console.error('Error fetching provider:', error)
    return null
  }

  return data
}

    // Helper function to upsert category
    export async function upsertCategory(
      providerId: string,
      name: string,
      parentId?: string,
      imageUrl?: string,
      sortOrder?: number,
      isFeatured?: boolean
    ): Promise<Category | null> {
      const supabase = await createServiceClient()
      const slug = createSlug(name)
      
      const { data, error } = await supabase
        .from('categories')
        .upsert({
          provider_id: providerId,
          name,
          slug,
          parent_id: parentId,
          image_url: imageUrl,
          sort_order: sortOrder || 0,
          is_featured: isFeatured || false,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'provider_id,slug'
        })
        .select()
        .single()

      if (error) {
        console.error('Error upserting category:', error)
        return null
      }

      return data
    }

    // Helper function to get category by name
    export async function getCategoryByName(providerId: string, name: string): Promise<Category | null> {
      const supabase = await createServiceClient()
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('provider_id', providerId)
        .eq('name', name)
        .single()

      if (error) {
        console.error('Error fetching category by name:', error)
        return null
      }

      return data
    }

// Helper function to upsert product
export async function upsertProduct(
  providerId: string,
  categoryId: string,
  name: string,
  description: string,
  basePriceUsd: number,
  thumbnailUrl?: string,
  techniques?: any[],
  // Additional Printful v2 API fields
  printfulId?: number,
  type?: string,
  brand?: string,
  model?: string,
  variantCount?: number,
  isDiscontinued?: boolean,
  sizes?: string[],
  colors?: any[],
  placements?: any[],
  productOptions?: any[]
): Promise<Product | null> {
  const supabase = await createServiceClient()
  const slug = createSlug(name)
  
  const { data, error } = await supabase
    .from('products')
    .upsert({
      provider_id: providerId,
      category_id: categoryId,
      name,
      description,
      slug,
      base_price_usd: basePriceUsd,
      thumbnail_url: thumbnailUrl,
      techniques: techniques || null,
      printful_id: printfulId,
      type: type,
      brand: brand,
      model: model,
      variant_count: variantCount,
      is_discontinued: isDiscontinued,
      sizes: sizes || null,
      colors: colors || null,
      placements: placements || null,
      product_options: productOptions || null,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'slug'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting product:', error)
    return null
  }

  return data
}

// Helper function to upsert variant
export async function upsertVariant(
  productId: string,
  sku: string | undefined,
  size: string | undefined,
  color: string | undefined,
  imageUrl: string | undefined,
  basePriceUsd: number,
  stockStatus: string = 'in_stock'
): Promise<Variant | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('variants')
    .upsert({
      product_id: productId,
      sku,
      size,
      color,
      image_url: imageUrl,
      base_price_usd: basePriceUsd,
      stock_status: stockStatus,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'product_id,sku'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting variant:', error)
    return null
  }

  return data
}

// Helper function to upsert image
export async function upsertImage(
  productId: string,
  variantId: string | undefined,
  url: string,
  type: 'thumbnail' | 'mockup' | 'detail' | 'lifestyle',
  gender?: 'male' | 'female' | 'unisex'
): Promise<Image | null> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('images')
    .upsert({
      product_id: productId,
      variant_id: variantId,
      url,
      type,
      gender,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'product_id,variant_id,url,type'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting image:', error)
    return null
  }

  return data
}

// Helper function to upsert product translation
export async function upsertProductTranslation(
  productId: string,
  languageCode: string,
  title: string,
  description?: string
): Promise<ProductTranslation | null> {
  const supabase = await createServiceClient()
  
  const { data, error } = await supabase
    .from('product_translations')
    .upsert({
      product_id: productId,
      language_code: languageCode,
      title,
      description,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'product_id,language_code'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting product translation:', error)
    return null
  }

  return data
}

// Helper function to upsert category translation
export async function upsertCategoryTranslation(
  categoryId: string,
  languageCode: string,
  title: string,
  description?: string
): Promise<CategoryTranslation | null> {
  const supabase = await createServiceClient()
  
  const { data, error } = await supabase
    .from('category_translations')
    .upsert({
      category_id: categoryId,
      language_code: languageCode,
      title,
      description,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'category_id,language_code'
    })
    .select()
    .single()

  if (error) {
    console.error('Error upserting category translation:', error)
    return null
  }

  return data
}
