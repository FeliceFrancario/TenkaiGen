import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string, locale?: string) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (locale) headers['X-PF-Language'] = locale
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

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Starting simple v2 sync...')
    
    const supabase = await createServiceClient()
    
    // Get provider
    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('name', 'Printful')
      .single()
    
    if (!provider) {
      throw new Error('Printful provider not found')
    }
    
    // Get categories to map Printful IDs to database IDs
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
    
    const categoryMap = new Map<string, string>()
    categories?.forEach(cat => {
      // Map by name for now
      categoryMap.set(cat.name.toLowerCase(), cat.id)
    })
    
    console.log('📋 Category map:', Array.from(categoryMap.entries()))
    
    // Fetch products from v2 API
    console.log('🔍 Fetching products from v2 API...')
    const response = await pf('/v2/catalog-products?limit=50')
    const products = response?.data || []
    
    console.log(`📦 Found ${products.length} products`)
    
    let syncedCount = 0
    
    for (const product of products) {
      try {
        // Map product to category based on main_category_id
        const mainCategoryId = product.main_category_id
        
        // For now, let's map to a default category
        let categoryId = categoryMap.get('men\'s clothing') // Default fallback
        
        // Try to find the right category
        if (mainCategoryId) {
          // This is where we'd need to map Printful category IDs to our database IDs
          // For now, let's use a simple mapping
          if (mainCategoryId >= 1 && mainCategoryId <= 5) {
            // Root categories
            const rootCategories = ['men\'s clothing', 'women\'s clothing', 'kids\' & youth clothing', 'accessories', 'home & living']
            const categoryName = rootCategories[mainCategoryId - 1]
            categoryId = categoryMap.get(categoryName)
          } else {
            // Subcategories - map to parent
            if (mainCategoryId >= 6 && mainCategoryId <= 7) {
              categoryId = categoryMap.get('men\'s clothing')
            } else if (mainCategoryId >= 8 && mainCategoryId <= 11) {
              categoryId = categoryMap.get('women\'s clothing')
            }
          }
        }
        
        if (!categoryId) {
          console.warn(`⚠️ No category found for product: ${product.name} (main_category_id: ${mainCategoryId})`)
          continue
        }
        
        // Calculate base price (we'll use a default for now)
        const basePriceUsd = 10.00 // Default price
        
        // Insert product
        const { error } = await supabase
          .from('products')
          .insert({
            provider_id: provider.id,
            category_id: categoryId,
            name: product.name,
            description: product.description || '',
            slug: product.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
            base_price_usd: basePriceUsd,
            thumbnail_url: product.image
          })
        
        if (error) {
          console.error(`❌ Error inserting product ${product.name}:`, error)
        } else {
          syncedCount++
          console.log(`✅ Synced product: ${product.name}`)
        }
        
      } catch (productError) {
        console.error(`❌ Error syncing product ${product.name}:`, productError)
      }
    }
    
    console.log(`🎉 Sync completed! Synced ${syncedCount} products`)
    
    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} products successfully`,
      syncedCount
    })
    
  } catch (error: any) {
    console.error('❌ Sync error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Sync failed' 
    }, { status: 500 })
  }
}
