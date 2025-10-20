import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'
import { calculateRetailPrice, formatPrice } from '@/lib/pricing'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let categoryId = searchParams.get('category_id')
    const printfulId = searchParams.get('printful_id')
    const currency = searchParams.get('currency') || 'USD'
    const limit = Number(searchParams.get('limit') || '24')
    const offset = Number(searchParams.get('offset') || '0')
    const sort = searchParams.get('sort') || 'bestseller'
    
    const supabase = await createServiceClient()

    // Accept numeric Printful category_id by resolving to our UUID
    if (categoryId && !categoryId.includes('-')) {
      const pfId = parseInt(categoryId, 10)
      if (!Number.isNaN(pfId)) {
        const { data: catRow } = await supabase
          .from('categories')
          .select('id')
          .eq('printful_id', pfId)
          .limit(1)
        categoryId = catRow?.[0]?.id || categoryId
      }
    }

    // Build query - simplified to avoid complex joins
    let query = supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        slug,
        base_price_usd,
        thumbnail_url,
        category_id,
        techniques,
        printful_id
      `)
      .range(offset, offset + limit - 1)
    
    if (categoryId) {
      // If still numeric after resolution failure, return empty result gracefully
      if (!categoryId.includes('-')) {
        return NextResponse.json({
          success: true,
          result: [],
          total: 0,
          hasMore: false,
          pagination: { limit, offset, total: 0 }
        })
      }
      query = query.eq('category_id', categoryId)
    }
    
    if (printfulId) {
      const pf = parseInt(printfulId, 10)
      if (!Number.isNaN(pf)) {
        query = query.eq('printful_id', pf)
      }
    }
    
    // Apply sorting
    switch (sort) {
      case 'price':
        query = query.order('base_price_usd', { ascending: true })
        break
      case 'price-desc':
        query = query.order('base_price_usd', { ascending: false })
        break
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      case 'bestseller':
        // For now, use newest as bestseller proxy
        query = query.order('created_at', { ascending: false })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }
    
    const { data: products, error } = await query
    
    if (error) {
      console.error('Database products error:', error)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
    
    // Filter out embroidery-only products (keep them in DB but don't display them)
    const filteredProducts = products?.filter(product => {
      if (!product.techniques || !Array.isArray(product.techniques)) {
        return true // Include products without technique info
      }
      
      const techniqueKeys = product.techniques.map((t: any) => t.key?.toLowerCase() || '')
      const hasOnlyEmbroidery = techniqueKeys.length === 1 && techniqueKeys.includes('embroidery')
      
      return !hasOnlyEmbroidery // Exclude embroidery-only products
    }) || []
    
    console.log(`📊 Filtered ${products?.length || 0} products to ${filteredProducts.length} (removed embroidery-only)`)
    
    // Calculate prices and transform data
    const transformedProducts = await Promise.all(
      filteredProducts.map(async (product) => {
        // Try cached price first
        const cached = await supabase
          .from('product_prices')
          .select('selling_price')
          .eq('product_id', product.id)
          .eq('currency', currency)
          .maybeSingle()

        let sellingPrice = cached?.data?.selling_price as number | undefined

        if (sellingPrice == null) {
          const pricing = await calculateRetailPrice(
            product.base_price_usd,
            currency,
            product.id
          )
          sellingPrice = pricing.retailPrice
          // Cache asynchronously (don't block response)
          supabase.from('product_prices').upsert({
            product_id: product.id,
            currency,
            region: 'global',
            selling_price: sellingPrice,
            includes_design: true,
            exchange_rate_used: pricing.exchangeRateUsed,
            source: 'calculated'
          }, { onConflict: 'product_id,currency,region' }).then(({ error }) => {
            if (error) console.error('product_prices upsert error', error)
          }).catch((e) => console.error('product_prices upsert threw', e))
        }

        return {
          id: product.id,
          db_id: product.id,
          title: product.name,
          main_category_id: product.category_id,
          thumbnail: product.thumbnail_url,
          price: sellingPrice?.toFixed(2) ?? null,
          currency,
          formatted_price: sellingPrice != null ? formatPrice(sellingPrice, currency) : null,
          _ships: true,
          description: product.description
        }
      }) || []
    )
    
    // Get total count for pagination
    let countQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
    
    if (categoryId) {
      countQuery = countQuery.eq('category_id', categoryId)
    }
    
    const { count } = await countQuery
    
    return NextResponse.json({
      success: true,
      result: transformedProducts,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    })
    
  } catch (error: any) {
    console.error('Products API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to fetch products' 
    }, { status: 500 })
  }
}
