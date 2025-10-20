import { createServiceClient } from './database'

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_TOKEN
const PRINTFUL_BASE_URL = 'https://api.printful.com'

// Helper function to handle API calls with retry on rate limit
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, options)
    
    if (response.status === 429) {
      const retryAfter = parseFloat(response.headers.get('Retry-After') || '1')
      console.log(`⏳ Rate limited. Waiting ${retryAfter}s before retry (attempt ${attempt + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
      continue
    }
    
    return response
  }
  
  // Final attempt
  return fetch(url, options)
}

// Optimized sync with better rate limiting
export async function optimizedSync(locale: string = 'en_US') {
  console.log(`🚀 Starting OPTIMIZED sync for language: ${locale}`)
  
  const supabase = await createServiceClient()
  
  // Get or create Printful provider
  let { data: provider } = await supabase
    .from('providers')
    .select('id')
    .eq('name', 'Printful')
    .single()

  if (!provider) {
    const { data: newProvider } = await supabase
      .from('providers')
      .insert({
        name: 'Printful',
        api_base_url: PRINTFUL_BASE_URL
      })
      .select()
      .single()
    provider = newProvider
  }

  const providerId = provider.id

  // Step 1: Sync categories (fast, no delays needed)
  console.log('📂 Syncing categories...')
  await syncCategories(providerId, locale)
  
  // Step 2: Get all products in batches (optimized)
  console.log('📦 Fetching all products...')
  const allProducts = await fetchAllProductsOptimized(locale)
  console.log(`📊 Total products to process: ${allProducts.length}`)
  
  if (allProducts.length === 0) {
    console.log('❌ No products found! Check API response structure.')
    return
  }
  
  // Step 3: Process products in optimized batches
  console.log('⚡ Processing products with optimized rate limiting...')
  await processProductsOptimized(allProducts, providerId, locale)
  
  console.log(`✅ OPTIMIZED sync completed for language: ${locale}`)
}

async function syncCategories(providerId: string, locale: string) {
  // Use v1 categories to fetch full tree (IDs match main_category_id used by products)
  const response = await fetch(`${PRINTFUL_BASE_URL}/categories`, {
    headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
  })
  if (!response.ok) {
    throw new Error(`Categories API failed: ${response.status}`)
  }
  const data = await response.json()
  const categories = Array.isArray(data?.result)
    ? data.result
    : (Array.isArray(data?.result?.categories) ? data.result.categories : [])
  console.log(`📂 Found ${categories.length} categories (v1)`) 

  const supabase = await createServiceClient()

  // First pass: upsert categories with printful_id (no parent relationship yet)
  for (const category of categories) {
    const slug = createSlug(category.title)
    const { error: catErr } = await supabase
      .from('categories')
      .upsert({
        provider_id: providerId,
        name: category.title,
        slug,
        printful_id: category.id,
        image_url: category.image_url,
        sort_order: category.sort_order || 0,
        is_featured: category.is_featured || false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'provider_id,slug'
      })
    if (catErr) {
      console.log(`❌ Category upsert failed for ${category.title} (${category.id})`, catErr)
    }

    // Fallback: if a legacy row exists keyed by slug, ensure printful_id is set
    try {
      const { error: fallbackErr } = await supabase
        .from('categories')
        .update({
          printful_id: category.id,
          image_url: category.image_url,
          sort_order: category.sort_order || 0,
          is_featured: category.is_featured || false,
          updated_at: new Date().toISOString()
        })
        .eq('provider_id', providerId)
        .eq('slug', slug)
        .is('printful_id', null)
      if (fallbackErr) {
        console.log(`⚠️ Fallback category update failed for ${category.title} (${category.id})`, fallbackErr)
      }
    } catch (e) {
      console.log(`⚠️ Fallback category update threw for ${category.title} (${category.id})`, e)
    }
  }

  // Second pass: update parent relationships now that all categories exist
  for (const category of categories) {
    if (category.parent_id) {
      const { data: child } = await supabase
        .from('categories')
        .select('id')
        .eq('provider_id', providerId)
        .eq('printful_id', category.id)
        .limit(1)
      const { data: parent } = await supabase
        .from('categories')
        .select('id')
        .eq('provider_id', providerId)
        .eq('printful_id', category.parent_id)
        .limit(1)
      const childId = child?.[0]?.id
      const parentId = parent?.[0]?.id
      if (childId && parentId) {
        await supabase
          .from('categories')
          .update({ parent_id: parentId, updated_at: new Date().toISOString() })
          .eq('id', childId)
      }
    }
  }
}

async function fetchAllProductsOptimized(locale: string) {
  const allProducts = []
  let offset = 0
  const limit = 100
  
  while (true) {
    const response = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-products?limit=${limit}&offset=${offset}`, {
      headers: { 
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`Products API failed: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('API Response structure:', Object.keys(data))
    console.log('Result keys:', data?.result ? Object.keys(data.result) : 'No result')
    console.log('Data keys:', data?.data ? Object.keys(data.data) : 'No data')
    
    // Printful v2 API returns data in 'data' field
    const products = data?.data || []
    console.log(`Found ${products.length} products in this batch`)
    
    allProducts.push(...products)
    
    if (products.length < limit) {
      break
    }
    
    offset += limit
    
    // Rate limit: 120 requests per minute = 1 request every 500ms
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return allProducts
}

async function processProductsOptimized(products: any[], providerId: string, locale: string) {
  const supabase = await createServiceClient()
  
  // Fetch existing product ids to allow upsert (no skipping)
  const { data: existingProducts } = await supabase
    .from('products')
    .select('printful_id')
  const existingIds = new Set(existingProducts?.map(p => p.printful_id) || [])
  
  let processed = 0
  let skipped = 0
  
  // Process in batches of 5 with optimized delays (reduced to avoid rate limiting)
  for (let i = 0; i < products.length; i += 5) {
    const batch = products.slice(i, i + 5)
    
    // Process batch concurrently (much faster)
    const promises = batch.map(async (product) => {
      return await processSingleProduct(product, providerId, locale)
    })
    
    await Promise.all(promises)
    processed += batch.length
    
    console.log(`⚡ Processed batch ${Math.floor(i/10) + 1}/${Math.ceil(products.length/10)} (${processed}/${products.length} products)`)
    
    // Rate limit: Longer delay to accommodate mockup styles requests
    if (i + 5 < products.length) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay between batches
    }
  }
  
  console.log(`📊 Processing complete: ${processed} processed, ${skipped} skipped`)
}

async function processSingleProduct(product: any, providerId: string, locale: string) {
  try {
    // Local Supabase client for this product scope
    const supabase = await createServiceClient()
    // Get detailed product data
    const response = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-products/${product.id}`, {
      headers: { 
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'X-PF-Locale': locale
      }
    })
    
    if (!response.ok) {
      console.log(`⚠️ Product ${product.id} failed: ${response.status}`)
      return
    }
    
    const productData = await response.json()
    const pd = productData?.data || productData?.result || {}
    const techniques = pd?.techniques || []
    
    // Filter out knitting/knitwear products (case-insensitive)
    const techniqueKeys = techniques.map((t: any) => t.key?.toLowerCase() || '')
    const productType = (pd?.type || '')?.toLowerCase() || ''
    const productName = product.name?.toLowerCase() || ''
    
    const isKnittingProduct = 
      techniqueKeys.includes('knitting') || 
      techniqueKeys.includes('knitwear') ||
      productType.includes('knitwear') ||
      productType.includes('knitting') ||
      productName.includes('knitwear') ||
      productName.includes('knitting')
    
    if (isKnittingProduct) {
      console.log(`⏭️ SKIPPING knitting product: ${product.name}`)
      return
    }
    
    // Fetch variants early to compute base price
    const variants = await fetchProductVariants(product.id)
    let basePriceUsd = 0
    if (variants.length > 0) {
      const prices = await Promise.all(
        variants.map(async (variant: any) => {
          try {
            const priceResponse = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-variants/${variant.id}/prices`, {
              headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
            })
            if (priceResponse.ok) {
              const priceData = await priceResponse.json()
              const d = priceData?.data || priceData?.result || priceData || {}
              const amt = d?.price?.amount ?? d?.price ?? d?.min_price?.amount ?? d?.min_price
              const n = parseFloat(String(amt ?? '0'))
              if (Number.isFinite(n) && n > 0) return n
            }
          } catch (error) {
            console.log(`⚠️ Error fetching price for variant ${variant.id}`)
          }
          return 0
        })
      )
      const validPrices = prices.filter(p => p > 0)
      basePriceUsd = validPrices.length > 0 ? Math.min(...validPrices) : 0
    }

    // If variant-level price failed, try product-level prices (USD) via v2
    if (basePriceUsd <= 0) {
      try {
        const pr = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-products/${product.id}/prices?currency=USD`, {
          headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
        })
        if (pr.ok) {
          const pj = await pr.json()
          const payload = pj?.data || pj?.result || pj || {}
          // payload may be array or object; scan for minimal price
          const collect = (obj: any): number[] => {
            const nums: number[] = []
            const tryPush = (v: any) => {
              const n = parseFloat(String(v))
              if (Number.isFinite(n) && n > 0) nums.push(n)
            }
            if (Array.isArray(obj?.variants)) {
              for (const v of obj.variants) {
                if (Array.isArray(v?.techniques)) {
                  for (const t of v.techniques) {
                    tryPush(t?.price?.amount ?? t?.price ?? t?.discounted_price)
                  }
                }
              }
            }
            // common shapes
            tryPush(obj?.price?.amount ?? obj?.price)
            tryPush(obj?.min_price?.amount ?? obj?.min_price)
            return nums
          }
          const arr = Array.isArray(payload) ? payload.flatMap(collect) : collect(payload)
          if (arr.length > 0) basePriceUsd = Math.min(...arr)
        }
      } catch {}
    }

    // Final fallback: v1 catalog product detail minimal variant price
    if (basePriceUsd <= 0) {
      try {
        const v1 = await fetch(`${PRINTFUL_BASE_URL}/products/${product.id}`, {
          headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
        })
        if (v1.ok) {
          const v1j = await v1.json()
          const variants: any[] = Array.isArray(v1j?.result?.variants) ? v1j.result.variants : []
          let min = Number.POSITIVE_INFINITY
          for (const v of variants) {
            const raw = v?.price ?? v?.retail_price
            const n = parseFloat(String(raw ?? '0'))
            if (Number.isFinite(n) && n > 0 && n < min) min = n
          }
          if (Number.isFinite(min) && min > 0) basePriceUsd = min
        }
      } catch {}
    }

    // Resolve category with robust fallback
    const categoryId = await resolveCategoryId(product, pd, providerId)
    const categoryIdToUse = categoryId || await getCategoryIdByPrintfulId(277, providerId)
    if (!categoryIdToUse) {
      console.log(`⚠️ No category found and 'All products' missing; skipping ${product.name}`)
      return
    }
    
    // Upsert product with comprehensive data
    const { data: dbProduct, error } = await upsertProductRecord({
      providerId,
      categoryId: categoryIdToUse,
      product,
      pd,
      basePriceUsd,
      techniques
    })
    
    if (error) {
      console.log(`❌ Error upserting product ${product.name}:`, error)
      return
    }
    
    console.log(`✅ Synced: ${product.name}`)
    
    // Sync variants for this product
    await syncProductVariants(dbProduct.id, variants, supabase)
    
    // Add delay before mockup styles to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Sync mockup styles for this product
    await syncProductMockupStyles(dbProduct.id, product.id, supabase)
    
    // Sync product translation
    await syncProductTranslation(dbProduct.id, product.name, pd?.description || '', locale, supabase)
    
  } catch (error) {
    console.log(`❌ Error processing product ${product.name}:`, error)
  }
}

async function getCategoryIdByPrintfulId(printfulId: number, providerId: string): Promise<string | null> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('provider_id', providerId)
    .eq('printful_id', printfulId)
    .limit(1)
  return data?.[0]?.id || null
}

async function resolveCategoryId(product: any, pd: any, providerId: string): Promise<string | null> {
  // Try list item main_category_id
  if (product?.main_category_id) {
    const id = await getCategoryIdByPrintfulId(product.main_category_id, providerId)
    if (id) return id
  }

  // Try detail payload main_category_id
  if (pd?.main_category_id) {
    const id = await getCategoryIdByPrintfulId(pd.main_category_id, providerId)
    if (id) return id
  }

  // Try categories array in detail payload
  const categoriesArray = Array.isArray(pd?.categories) ? pd.categories : []
  if (categoriesArray.length > 0) {
    // Prefer category marked as main, else first
    const main = categoriesArray.find((c: any) => c?.is_main || c?.main) || categoriesArray[0]
    if (main?.id) {
      const id = await getCategoryIdByPrintfulId(main.id, providerId)
      if (id) return id
    }
  }
  return null
}

async function upsertProductRecord(args: { providerId: string, categoryId: string, product: any, pd: any, basePriceUsd: number, techniques: any[] }) {
  const { providerId, categoryId, product, pd, basePriceUsd, techniques } = args
  const supabase = await createServiceClient()
  const slug = createSlug(product.name)
  return await supabase
    .from('products')
    .upsert({
      provider_id: providerId,
      category_id: categoryId,
      name: product.name || 'Unnamed Product',
      description: pd?.description || '',
      slug,
      base_price_usd: basePriceUsd,
      thumbnail_url: pd?.image,
      techniques: techniques,
      printful_id: product.id,
      type: pd?.type,
      brand: pd?.brand,
      model: pd?.model,
      variant_count: pd?.variant_count,
      is_discontinued: pd?.is_discontinued,
      sizes: pd?.sizes,
      colors: pd?.colors,
      placements: pd?.placements,
      product_options: pd?.product_options,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'slug'
    })
    .select()
    .single()
}

async function fetchProductVariants(productId: number): Promise<any[]> {
  const allVariants = []
  let offset = 0
  const limit = 100
  
  while (true) {
    try {
      const response = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-products/${productId}/catalog-variants?limit=${limit}&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
      })
      
      if (!response.ok) {
        console.log(`⚠️ Variants API failed for product ${productId}: ${response.status}`)
        break
      }
      
      const data = await response.json()
      const variants = data?.data || []
      
      allVariants.push(...variants)
      
      if (variants.length < limit) {
        break
      }
      
      offset += limit
      
      // Small delay between variant batches
      await new Promise(resolve => setTimeout(resolve, 200))
      
    } catch (error) {
      console.log(`⚠️ Error fetching variants for product ${productId}:`, error)
      break
    }
  }
  
  return allVariants
}

async function syncProductVariants(productId: string, variants: any[], supabase: any) {
  if (!variants || variants.length === 0) return
  let minVariantPrice = Number.POSITIVE_INFINITY

  for (const variant of variants) {
    // Declare outside try-catch so it's accessible later
    let basePriceUsd = 0
    let currency: string | undefined = undefined
    
    try {
      // Get variant price
      try {
        const priceResponse = await fetchWithRetry(`${PRINTFUL_BASE_URL}/v2/catalog-variants/${variant.id}/prices`, {
          headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
        })
        if (priceResponse.ok) {
          const priceData = await priceResponse.json()
          const d = priceData?.data || priceData?.result || priceData || {}
          const raw = d?.price?.amount ?? d?.price ?? d?.min_price?.amount ?? d?.min_price
          const n = parseFloat(String(raw ?? '0'))
          if (Number.isFinite(n) && n > 0) basePriceUsd = n
          currency = (d?.currency as string | undefined) || currency
        }
      } catch (error) {
        console.log(`⚠️ Error fetching price for variant ${variant.id}`)
      }
      
      // Get variant availability
      let stockStatus = 'out_of_stock'
      try {
        const availabilityResponse = await fetchWithRetry(`${PRINTFUL_BASE_URL}/v2/catalog-variants/${variant.id}/availability`, {
          headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
        })
        if (availabilityResponse.ok) {
          const availabilityData = await availabilityResponse.json()
          const regions = availabilityData?.data?.availability_regions ?? availabilityData?.result?.availability_regions
          stockStatus = Array.isArray(regions) && regions.length > 0 ? 'in_stock' : 'out_of_stock'
        }
      } catch (error) {
        console.log(`⚠️ Error fetching availability for variant ${variant.id}`)
      }
      
      await supabase
        .from('variants')
        .upsert({
          product_id: productId,
          sku: (variant.sku || variant.id?.toString()) ?? undefined,
          printful_variant_id: variant.id,
          size: variant.size,
          color: variant.color,
          image_url: variant.image,
          base_price_usd: basePriceUsd,
          retail_price: basePriceUsd,
          currency: currency,
          stock_status: stockStatus,
          placement_dimensions: variant.placement_dimensions || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'product_id,sku', // Use the actual unique constraint
          ignoreDuplicates: false // Update existing records
        })
    } catch (error) {
      console.log(`⚠️ Error syncing variant for product ${productId}:`, error)
    }

    // Track minimal variant price to update product base price
    if (basePriceUsd > 0 && basePriceUsd < minVariantPrice) {
      minVariantPrice = basePriceUsd
    }

    // Gentle rate limit between variant calls
    await new Promise(resolve => setTimeout(resolve, 150))
  }

  // Update product base price from minimal variant price
  if (Number.isFinite(minVariantPrice) && minVariantPrice > 0) {
    try {
      await supabase
        .from('products')
        .update({ base_price_usd: minVariantPrice, updated_at: new Date().toISOString() })
        .eq('id', productId)
    } catch (e) {
      console.log(`⚠️ Failed updating base_price_usd for product ${productId}:`, e)
    }
  }
}

async function syncProductMockupStyles(productId: string, printfulProductId: number, supabase: any) {
  try {
    console.log(`🎨 [MOCKUP] Starting mockup sync for product ${printfulProductId} (DB: ${productId})`)
    
    // Fetch mockup styles from Printful API
    const response = await fetchWithRetry(`${PRINTFUL_BASE_URL}/v2/catalog-products/${printfulProductId}/mockup-styles`, {
      headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
    })
    
    console.log(`🎨 [MOCKUP] Product ${printfulProductId} API response: ${response.status}`)
    
    if (!response.ok) {
      console.log(`⚠️ Mockup styles API failed for product ${printfulProductId}: ${response.status}`)
      const errorText = await response.text()
      console.log(`   Error body: ${errorText.substring(0, 200)}`)
      return
    }
    
    const data = await response.json()
    const placements = data?.data || []
    
    console.log(`📸 Product ${printfulProductId}: Found ${placements.length} placements`)
    if (placements.length > 0) {
      console.log(`   First placement has ${placements[0].mockup_styles?.length || 0} mockup styles`)
    }
    
    // Filter out holiday versions and sync only relevant styles
    const EXCLUDED_CATEGORIES = [
      "Holiday season", "Christmas", "Halloween", "Valentine's", "Spring/summer vibes"
    ]
    
    let syncedCount = 0
    
    // data.data is an array of placements directly
    for (const placement of placements) {
      // Sync each mockup style for this placement
      for (const mockupStyle of placement.mockup_styles || []) {
        // Skip holiday versions
        if (EXCLUDED_CATEGORIES.some(excluded => mockupStyle.category_name?.includes(excluded))) {
          continue
        }
        
        try {
          const { data: insertData, error: insertError } = await supabase
            .from('mockup_styles')
            .upsert({
              product_id: productId,
              placement: placement.placement,
              technique: placement.technique,
              print_area_width: placement.print_area_width,
              print_area_height: placement.print_area_height,
              print_area_type: placement.print_area_type,
              dpi: placement.dpi,
              style_id: mockupStyle.id,
              category_name: mockupStyle.category_name,
              view_name: mockupStyle.view_name,
              restricted_to_variants: mockupStyle.restricted_to_variants,
              created_at: new Date().toISOString()
            }, {
              onConflict: 'product_id,placement,style_id'
            })
          
          if (insertError) {
            console.log(`⚠️ DB insert error for mockup style ${mockupStyle.id}:`, insertError)
            if (syncedCount === 0) {
              // Log first error in detail
              console.log(`   Product ID: ${productId}, Placement: ${placement.placement}, Style ID: ${mockupStyle.id}`)
            }
          } else {
            syncedCount++
          }
        } catch (error) {
          console.log(`⚠️ Exception syncing mockup style ${mockupStyle.id} for product ${productId}:`, error)
        }
      }
    }
    
    console.log(`✅ Synced ${syncedCount} mockup styles for product ${printfulProductId}`)
    
  } catch (error) {
    console.log(`⚠️ Error syncing mockup styles for product ${printfulProductId}:`, error)
  }
}

async function syncProductTranslation(productId: string, title: string, description: string, locale: string, supabase: any) {
  try {
    await supabase
      .from('product_translations')
      .upsert({
        product_id: productId,
        language_code: locale,
        title: title,
        description: description,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'product_id,language_code'
      })
  } catch (error) {
    console.log(`⚠️ Error syncing translation for product ${productId}:`, error)
  }
}

function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
