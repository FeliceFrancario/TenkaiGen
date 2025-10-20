import { getProvider, upsertCategory, upsertProduct, upsertVariant, upsertImage, upsertProductTranslation, upsertCategoryTranslation, createServiceClient } from '@/lib/database'

const PRINTFUL_API_BASE = 'https://api.printful.com'

// Supported languages for multilingual sync (based on Printful v2 API documentation)
const SUPPORTED_LANGUAGES = [
  'en_US', // English (US)
  'en_GB', // English (GB)
  'en_CA', // English (CA)
  'es_ES', // Spanish (Spain)
  'fr_FR', // French (France)
  'de_DE', // German (Germany)
  'it_IT', // Italian (Italy)
  'ja_JP', // Japanese (Japan)
]

async function pf(path: string, locale?: string, retries = 5) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const headers: HeadersInit = { Authorization: `Bearer ${token}` }
  if (locale) headers['X-PF-Language'] = locale
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
        headers,
        cache: 'no-store',
      })
      
      if (res.ok) {
        return res.json()
      }
      
          if (res.status === 429) {
            const text = await res.text().catch(() => '')
            let errorData: any = {}
            try {
              errorData = JSON.parse(text)
            } catch {
              errorData = {}
            }
            const waitTime = (errorData as any)?.result?.match(/after (\d+) seconds/) || ['', '60']
            const seconds = parseInt(waitTime[1]) || 60
        
        if (attempt < retries) {
          const waitTime = Math.max(seconds, 60) // Wait at least 60 seconds
          console.log(`⏳ Rate limited, waiting ${waitTime} seconds before retry ${attempt + 1}/${retries}`)
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
          continue
        }
      }
      
      const text = await res.text().catch(() => '')
      throw new Error(`Printful API ${path} failed: ${res.status} ${text}`)
    } catch (error) {
      if (attempt === retries) throw error
      console.log(`⚠️ Attempt ${attempt} failed, retrying...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

// Main sync function
export async function syncPrintfulData(locale?: string): Promise<void> {
  console.log('🚀 Starting Printful multilingual sync...')
  
  try {
    // Get Printful provider
    console.log('🔍 Looking for Printful provider...')
    const provider = await getProvider('Printful')
    console.log('Provider result:', provider)
    
    if (!provider) {
      console.error('❌ Printful provider not found in database')
      throw new Error('Printful provider not found in database')
    }
    
    console.log(`📋 Using provider: ${provider.name} (ID: ${provider.id})`)
    
    // Sync categories first (with sorting info)
    await syncCategories(provider.id, locale)
    
    // Then sync products for all supported languages
    const languagesToSync = locale ? [locale] : SUPPORTED_LANGUAGES
    console.log(`🌍 Syncing products for ${languagesToSync.length} languages: ${languagesToSync.join(', ')}`)
    
    for (const lang of languagesToSync) {
      console.log(`\n🌐 Starting sync for language: ${lang}`)
      await syncProducts(provider.id, lang)
      console.log(`✅ Completed sync for language: ${lang}`)
      
      // Delay between languages to avoid rate limits
      if (lang !== languagesToSync[languagesToSync.length - 1]) {
        console.log('⏳ Waiting 5 seconds before next language...')
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    
    console.log('🎉 Printful multilingual sync completed successfully!')
  } catch (error) {
    console.error('💥 Printful sync failed:', error)
    throw error
  }
}

// Sync categories from Printful v1 API
async function syncCategories(providerId: string, locale?: string): Promise<void> {
  console.log('🔄 Syncing categories from v1 API...')
  console.log('Provider ID:', providerId)
  
  try {
    // Fetch categories from Printful v1 API
    const response = await pf('/categories', locale)
    console.log('Printful v1 categories response:', response)
    const categories = response?.result?.categories || []
    
    console.log(`📁 Found ${categories.length} categories`)
    
    if (categories.length === 0) {
      console.warn('⚠️ No categories found from Printful API')
      return
    }
    
    // Create a map to track parent-child relationships
    const categoryMap = new Map<number, string>() // Map Printful ID to DB ID
    const printfulCategoryData = new Map<number, any>() // Store original Printful category data

    // Process categories in batches to avoid timeouts
    const batchSize = 20
    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = categories.slice(i, i + batchSize)
      console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(categories.length/batchSize)}`)
      
      for (const category of batch) {
        printfulCategoryData.set(category.id, category)
        const categoryData = await upsertCategory(
          providerId,
          category.title || 'Unnamed Category',
          undefined, // parent_id will be set in second pass
          category.image_url, // Include thumbnail
          category.sort_order || 0, // Include sort order
          category.is_featured || false // Include featured flag
        )
        
        if (categoryData) {
          categoryMap.set(category.id, categoryData.id)
          console.log(`✅ Synced category: ${category.title} (Printful ID: ${category.id}) with thumbnail: ${category.image_url ? 'Yes' : 'No'}`)
          
          // Upsert category translation for current language
          await upsertCategoryTranslation(
            categoryData.id,
            locale || 'en_US',
            category.title || 'Unnamed Category',
            category.description || ''
          )
        } else {
          console.error(`❌ Failed to sync category: ${category.title}`)
        }
      }
      
      // Small delay between batches
      if (i + batchSize < categories.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    // Second pass: update parent relationships
    for (const category of categories) {
      if (category.parent_id && categoryMap.has(category.parent_id)) {
        const parentDbId = categoryMap.get(category.parent_id)!
        const childDbId = categoryMap.get(category.id)
        
        if (childDbId) {
          // Update the category with the correct parent
          const supabase = await createServiceClient()
          const { error } = await supabase
            .from('categories')
            .update({ parent_id: parentDbId })
            .eq('id', childDbId)
          
          if (error) {
            console.error(`❌ Failed to update parent for category ${category.title}:`, error)
          } else {
            console.log(`✅ Updated parent for category: ${category.title}`)
          }
        }
      }
    }
    
    console.log('✅ Categories sync completed')
  } catch (error) {
    console.error('❌ Error syncing categories:', error)
    throw error
  }
}

// Sync products from Printful v1 API
async function syncProducts(providerId: string, locale?: string): Promise<void> {
  console.log('🔄 Syncing products from v1 API...')
  
  try {
    // First, get all categories to map Printful category IDs to our database IDs
    const supabase = await createServiceClient()
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name, slug')
      .eq('provider_id', providerId)
    
    const categoryMap = new Map<string, string>()
    categories?.forEach(cat => {
      categoryMap.set(cat.name.toLowerCase(), cat.id)
      categoryMap.set(cat.slug.toLowerCase(), cat.id) // Also map by slug
    })

    // Fetch ALL products from Printful v2 API using proper pagination and sorting
    let allProducts: any[] = []
    let offset = 0
    const limit = 100
    let hasMore = true
    
    console.log(`📦 Fetching products for language: ${locale}`)
    
    while (hasMore) {
      console.log(`📦 Fetching products batch: offset=${offset}, limit=${limit}`)
      
      try {
        // Use v2 API with proper parameters - no locale needed for basic product list
        const response = await pf(`/v2/catalog-products?limit=${limit}&offset=${offset}`)
        const products = response?.data || []
        
        if (products.length === 0) {
          console.log(`📦 No more products found at offset ${offset}`)
          hasMore = false
          break
        }
        
        allProducts = allProducts.concat(products)
        console.log(`📦 Fetched ${products.length} products (total so far: ${allProducts.length})`)
        
        // If we got fewer products than the limit, we've reached the end
        if (products.length < limit) {
          console.log(`📦 Reached end - got ${products.length} products (less than limit ${limit})`)
          hasMore = false
        } else {
          offset += limit
          // Small delay between API calls to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error) {
        console.error(`❌ Error fetching products batch at offset ${offset}:`, error)
        // If we get an error, try to continue with what we have
        hasMore = false
      }
    }
    
    console.log(`📦 Total products fetched: ${allProducts.length}`)

    if (allProducts.length === 0) {
      console.warn('⚠️ No products returned from Printful API')
      return
    }

    // Check which products are already synced
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, name')
      .eq('provider_id', providerId)
    
    const existingProductNames = new Set(existingProducts?.map(p => p.name) || [])
    console.log(`📊 Found ${existingProductNames.size} existing products, will skip duplicates`)

    // Process products sequentially to avoid rate limits
    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i]
      
      // Update existing products with technique info, or process new products
      if (existingProductNames.has(product.title)) {
        console.log(`🔄 Updating existing product with technique info: ${product.title}`)
        // Don't skip - process it to update technique info
      }
      
      try {
        console.log(`📦 Processing product ${i + 1}/${allProducts.length}: ${product.title}`)
        
        // Add delay between requests to respect rate limits
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
        }
        
        // Get product details (v2 API)
        const productDetail = await pf(`/v2/catalog-products/${product.id}`, locale)
        const productData = productDetail?.data || {}
        const variants = productData.variants || []
        const techniques = productData.techniques || []
        
        console.log(`📦 Product data for ${product.name}:`, {
          id: product.id,
          name: product.name,
          main_category_id: product.main_category_id,
          techniques: techniques,
          techniques_count: techniques.length
        })
        
        // Filter out knitting/knitwear products (case-insensitive)
        const techniqueKeys = techniques.map((t: any) => t.key?.toLowerCase() || '')
        const productType = productData.type?.toLowerCase() || ''
        const productName = product.name?.toLowerCase() || ''
        
        console.log(`📦 Product analysis for ${product.name}:`, {
          techniqueKeys,
          productType,
          productName: product.name
        })
        
        // Check if product is knitting/knitwear (exclude these completely)
        const isKnittingProduct = 
          techniqueKeys.includes('knitting') || 
          techniqueKeys.includes('knitwear') ||
          productType.includes('knitwear') ||
          productType.includes('knitting') ||
          productName.includes('knitwear') ||
          productName.includes('knitting')
        
        if (isKnittingProduct) {
          console.log(`⏭️ SKIPPING knitting/knitwear product: ${product.name} (type: ${productData.type}, techniques: ${techniqueKeys.join(', ')})`)
          continue
        }
        
        // Log embroidery-only products but still process them (will be filtered on display)
        const hasOnlyEmbroidery = techniqueKeys.length === 1 && techniqueKeys.includes('embroidery')
        if (hasOnlyEmbroidery) {
          console.log(`📝 Storing embroidery-only product (will be filtered on display): ${product.name}`)
        }
        
        // Calculate base price (minimum variant price in USD)
        let basePriceUsd = 0
        if (variants.length > 0) {
          const prices = variants
            .map((v: any) => parseFloat(v.price || v.retail_price || '0'))
            .filter((p: number) => !isNaN(p) && p > 0)
          
          if (prices.length > 0) {
            basePriceUsd = Math.min(...prices)
          }
        }
        
        // Get thumbnail
        const thumbnailUrl = variants[0]?.image || product.image || null
        
        // Map to category using main_category_id from v2 API
        const mainCategoryId = product.main_category_id
        let categoryId = null
        
        console.log(`📦 Product "${product.name}" has main_category_id: ${mainCategoryId}`)
        
        if (mainCategoryId) {
          // Get the category name from Printful v1 API
          try {
            const categoryResponse = await pf(`/categories/${mainCategoryId}`, locale)
            const categoryName = categoryResponse?.result?.title
            
            if (categoryName) {
              categoryId = categoryMap.get(categoryName.toLowerCase())
              console.log(`📦 Mapping product "${product.name}" to category: ${categoryName} (ID: ${mainCategoryId}) -> DB ID: ${categoryId}`)
            } else {
              console.warn(`⚠️ No category name found for ID ${mainCategoryId}`)
            }
          } catch (categoryError) {
            console.warn(`⚠️ Could not fetch category ${mainCategoryId} for product ${product.name}:`, categoryError)
          }
        } else {
          console.warn(`⚠️ Product "${product.name}" has no main_category_id`)
        }
        
        // If no category found, try intelligent mapping based on product name
        if (!categoryId) {
          const productName = product.name || ''
          const productNameLower = productName.toLowerCase()
          
          // Home & living products
          if (productNameLower.includes('poster') || productNameLower.includes('canvas') || productNameLower.includes('print') || 
              productNameLower.includes('mug') || productNameLower.includes('cup') || productNameLower.includes('bottle') ||
              productNameLower.includes('pillow') || productNameLower.includes('blanket') || productNameLower.includes('candle')) {
            categoryId = categoryMap.get('home & living')
          }
          // Clothing products
          else if (productNameLower.includes('shirt') || productNameLower.includes('t-shirt') || productNameLower.includes('tank') ||
                   productNameLower.includes('hoodie') || productNameLower.includes('sweatshirt') || productNameLower.includes('sweater')) {
            // Determine if it's men's or women's based on product name
            if (productNameLower.includes('women') || productNameLower.includes('ladies') || productNameLower.includes('female')) {
              categoryId = categoryMap.get('women\'s clothing')
            } else if (productNameLower.includes('kids') || productNameLower.includes('youth') || productNameLower.includes('child')) {
              categoryId = categoryMap.get('kids\' & youth clothing')
            } else {
              // Default to men's clothing for unisex items
              categoryId = categoryMap.get('men\'s clothing')
            }
          }
          // Accessories
          else if (productNameLower.includes('hat') || productNameLower.includes('cap') || productNameLower.includes('beanie') ||
                   productNameLower.includes('bag') || productNameLower.includes('tote') || productNameLower.includes('backpack') ||
                   productNameLower.includes('phone case') || productNameLower.includes('laptop case') || productNameLower.includes('mouse pad')) {
            categoryId = categoryMap.get('accessories')
          }
          // If still no category found, skip this product
          else {
            console.warn(`⚠️ No category found for product: ${product.name} - skipping`)
            continue
          }
        }
        
        if (!categoryId) {
          console.warn(`⚠️ No category found for product: ${product.name} (main_category_id: ${mainCategoryId})`)
          continue
        }
        
        console.log(`📦 Mapping product "${product.name}" to category: ${mainCategoryId} -> ${categoryId}`)
        
        // Upsert product with comprehensive data
        const dbProduct = await upsertProduct(
          providerId,
          categoryId,
          product.name || 'Unnamed Product',
          productData.description || '',
          basePriceUsd,
          thumbnailUrl,
          techniques,
          // Additional Printful v2 API fields
          product.id, // printful_id
          productData.type,
          productData.brand,
          productData.model,
          productData.variant_count,
          productData.is_discontinued,
          productData.sizes,
          productData.colors,
          productData.placements,
          productData.product_options
        )
        
        if (dbProduct) {
          console.log(`✅ Synced product: ${product.name}`)
          
          // Sync product translation for current language
          await upsertProductTranslation(
            dbProduct.id,
            locale || 'en_US',
            product.name || 'Unnamed Product',
            productData.description || ''
          )
          
          // Sync variants (with delay to avoid rate limits)
          for (let j = 0; j < variants.length; j++) {
            const variant = variants[j]
            if (j > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay between variants
            }
            await upsertVariant(
              dbProduct.id,
              variant.sku,
              variant.size,
              variant.color,
              variant.image,
              parseFloat(variant.price || variant.retail_price || '0'),
              'in_stock'
            )
          }
          
          // Sync main product image
          if (thumbnailUrl) {
            await upsertImage(
              dbProduct.id,
              undefined, // No variant_id for main product images
              thumbnailUrl,
              'thumbnail',
              'unisex'
            )
          }
        }
        
      } catch (productError) {
        console.error(`❌ Error syncing product ${product.title}:`, productError)
      }
    }
    
    console.log('✅ Products sync completed')
  } catch (error) {
    console.error('❌ Error syncing products:', error)
    throw error
  }
}