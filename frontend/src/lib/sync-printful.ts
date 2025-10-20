import { getProvider, upsertCategory, upsertProduct, upsertVariant, upsertImage, createServiceClient } from '@/lib/database'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string, locale?: string) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  
  if (locale) {
    headers['X-PF-Language'] = locale
  }
  
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    headers,
    cache: 'no-store',
  })
  
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Printful API ${path} failed: ${res.status} ${text}`)
  }
  
  return res.json()
}

// Sync categories from Printful
export async function syncCategories(providerId: string, locale?: string): Promise<void> {
  console.log('🔄 Syncing categories...')
  console.log('Provider ID:', providerId)
  
  try {
    // Fetch categories from Printful v2 API
    const response = await pf('/v2/catalog-categories', locale)
    console.log('Printful categories response:', response)
    const categories = response?.data || []
    
    console.log(`📁 Found ${categories.length} categories`)
    
    if (categories.length === 0) {
      console.warn('⚠️ No categories found from Printful API')
      return
    }
    
    // Create a map to track parent-child relationships
    const categoryMap = new Map<string, string>()
    
    // First pass: create all categories
    for (const category of categories) {
      console.log('Processing category:', category.name || category.title)
      const categoryData = await upsertCategory(
        providerId,
        category.name || category.title || 'Unnamed Category',
        undefined // parent_id will be set in second pass
      )
      
      if (categoryData) {
        categoryMap.set(category.id, categoryData.id)
        console.log(`✅ Synced category: ${category.name}`)
      } else {
        console.error(`❌ Failed to sync category: ${category.name}`)
      }
    }
    
    // Second pass: update parent relationships
    for (const category of categories) {
      if (category.parent_id && categoryMap.has(category.parent_id)) {
        const parentDbId = categoryMap.get(category.parent_id)!
        const childDbId = categoryMap.get(category.id)
        
        if (childDbId) {
          await upsertCategory(
            providerId,
            category.name || category.title || 'Unnamed Category',
            parentDbId
          )
        }
      }
    }
    
    console.log('✅ Categories sync completed')
  } catch (error) {
    console.error('❌ Error syncing categories:', error)
    throw error
  }
}

// Sync products from Printful
export async function syncProducts(providerId: string, locale?: string): Promise<void> {
  console.log('🔄 Syncing products...')
  
  try {
    // First, get all categories to map Printful category IDs to our database IDs
    const supabase = await createServiceClient()
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('provider_id', providerId)
    
    const categoryMap = new Map<string, string>()
    categories?.forEach(cat => {
      // Map by name since Printful category names should match
      categoryMap.set(cat.name.toLowerCase(), cat.id)
    })
    
    // Define top-level categories like in your current catalog
    const TOP_TITLES = [
      "Men's clothing",
      "Women's clothing", 
      "Kids' & youth clothing",
      'Hats',
      'Accessories',
      'Home & living',
    ]
    
    // Create a mapping function like your current system
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    
    // Fetch products from Printful v2 API
    console.log('🔍 Fetching products from Printful v2 API...')
    const response = await pf('/v2/catalog-products?limit=100', locale)
    console.log('📋 Printful API response:', JSON.stringify(response, null, 2))
    const products = response?.data || []
    
    console.log(`📦 Found ${products.length} products`)
    
    if (products.length === 0) {
      console.warn('⚠️ No products returned from Printful API')
      return
    }
    
    for (const product of products) {
      try {
        // Get product details
        const productDetail = await pf(`/products/${product.id}`, locale)
        const productData = productDetail?.result?.product || {}
        const variants = productDetail?.result?.variants || []
        
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
        
        // Get thumbnail URL
        const thumbnailUrl = variants[0]?.image || product.image || null
        
        // Map to top-level category like your current system
        const mainCategoryName = product.main_category_name || 'Uncategorized'
        const normalizedMainCategory = norm(mainCategoryName)
        
        // Find matching top-level category
        let targetCategoryId = categoryMap.get('uncategorized')
        for (const topTitle of TOP_TITLES) {
          if (normalizedMainCategory.includes(norm(topTitle))) {
            targetCategoryId = categoryMap.get(norm(topTitle))
            break
          }
        }
        
        // Fallback: try to match by main category name directly
        if (!targetCategoryId) {
          targetCategoryId = categoryMap.get(normalizedMainCategory)
        }
        
        if (!targetCategoryId) {
          console.warn(`⚠️ No category found for product: ${product.name} (main_category: ${mainCategoryName})`)
          continue
        }
        
        // Upsert product
        const dbProduct = await upsertProduct(
          providerId,
          targetCategoryId,
          product.name || product.title || 'Unnamed Product',
          productData.description || '',
          basePriceUsd,
          thumbnailUrl
        )
        
        if (!dbProduct) {
          console.warn(`⚠️ Failed to upsert product: ${product.name}`)
          continue
        }
        
        console.log(`✅ Synced product: ${product.name} -> ${mainCategoryName}`)
        
        // Sync variants
        for (const variant of variants) {
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
        
        // Sync images from v2 API
        try {
          const imagesResponse = await pf(`/v2/catalog-products/${product.id}/images`, locale)
          const images = imagesResponse?.data || []
          
          for (const image of images) {
            // Determine image type and gender
            const url = image.image_url || ''
            let type: 'thumbnail' | 'mockup' | 'detail' | 'lifestyle' = 'mockup'
            let gender: 'male' | 'female' | 'unisex' | undefined = undefined
            
            if (url.includes('thumbnail')) {
              type = 'thumbnail'
            } else if (url.includes('lifestyle') || url.includes('model')) {
              type = 'lifestyle'
            } else if (url.includes('detail')) {
              type = 'detail'
            }
            
            // Determine gender
            if (url.includes('men') || url.includes('male')) {
              gender = 'male'
            } else if (url.includes('women') || url.includes('female')) {
              gender = 'female'
            } else if (url.includes('unisex')) {
              gender = 'unisex'
            }
            
            await upsertImage(
              dbProduct.id,
              undefined, // variant_id - we'll link to specific variants later if needed
              url,
              type,
              gender
            )
          }
        } catch (imageError) {
          console.warn(`⚠️ Failed to sync images for product ${product.name}:`, imageError)
        }
        
      } catch (productError) {
        console.error(`❌ Error syncing product ${product.name}:`, productError)
      }
    }
    
    console.log('✅ Products sync completed')
  } catch (error) {
    console.error('❌ Error syncing products:', error)
    throw error
  }
}

// Main sync function
export async function syncPrintfulData(locale?: string): Promise<void> {
  console.log('🚀 Starting Printful sync...')
  
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
    
    // Sync categories first
    await syncCategories(provider.id, locale)
    
    // Then sync products
    await syncProducts(provider.id, locale)
    
    console.log('🎉 Printful sync completed successfully!')
  } catch (error) {
    console.error('💥 Printful sync failed:', error)
    throw error
  }
}
