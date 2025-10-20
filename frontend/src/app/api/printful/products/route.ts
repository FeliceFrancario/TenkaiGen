import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'
import { calculateRetailPrice } from '@/lib/pricing'

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const limit = Number(searchParams.get('limit') || '24')
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const locale = searchParams.get('locale') || (req.cookies.get('locale')?.value || '')
    const countryCode = (searchParams.get('country_code') || req.cookies.get('country_code')?.value || '').toUpperCase()
    const sortType = searchParams.get('sort') || 'bestseller'
    const genderContext = (searchParams.get('gender') as 'male' | 'female' | 'unisex') || 'unisex'

    if (!categoryId) {
      return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
    }

    // 1) Get products using v2 API with proper sorting
    const batchSize = Math.max(100, limit * 3) // Fetch 3x the requested amount to account for filtering
    
    // Map sort types to v2 API parameters
    let sortDirection = 'ascending' // Default to ascending for bestseller
    if (sortType === 'price') {
      sortDirection = 'ascending' // Price should be ascending (cheapest first)
    } else if (sortType === 'new') {
      sortDirection = 'descending' // Newest first
    } else if (sortType === 'rating') {
      sortDirection = 'descending' // Highest rated first
    } else if (sortType === 'bestseller') {
      sortDirection = 'ascending' // Bestseller ascending (as confirmed in Postman)
    }
    
    let allProducts: Array<{ id: number; title: string; main_category_id: number }> = []
    let usedV2 = false
    
    try {
      // Use v2 API with proper sorting and category filtering
      const v2Url = `/v2/catalog-products?category_ids=${encodeURIComponent(categoryId)}&limit=${batchSize}&sort_type=${sortType}&sort_direction=${sortDirection}`
      const v2Response = await pf(v2Url, locale)
      
      if (v2Response?.data) {
        allProducts = (v2Response.data || []).map((p: any) => ({
          id: p.id,
          title: p.name || p.title, // v2 uses 'name' instead of 'title'
          main_category_id: p.main_category_id,
        }))
        usedV2 = true
      }
    } catch (v2Error) {
      console.log('v2 API failed, falling back to v1:', v2Error)
      // Fallback to v1 API without sorting
      const v1Response = await pf(`/products?category_id=${encodeURIComponent(categoryId)}&limit=${batchSize}`, locale)
      allProducts = (v1Response?.result || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        main_category_id: p.main_category_id,
      }))
      usedV2 = false
    }

    // Prepare DB client for our selling price override
    const supabase = await createServiceClient()

    // 2) Process products in batches to avoid overwhelming the API
    const batchLimit = 10 // Process 10 products at a time
    const processedProducts: any[] = []
    let processedCount = 0
    
    for (let i = 0; i < allProducts.length; i += batchLimit) {
      const batch = allProducts.slice(i, i + batchLimit)
      const batchResults = await Promise.all(
        batch.map(async (p) => {
          try {
            const detail = await pf(`/products/${p.id}`, locale)
            const firstVariant = (detail?.result?.variants || [])[0]
            let thumb = firstVariant?.image || null
            
            // Filter embroidery/knit-only products using v1 techniques
            try {
              const techniques: any[] = detail?.result?.product?.techniques || []
              const keys = techniques.map((t: any) => String(t?.key || t?.technique_key || '').toUpperCase()).filter(Boolean)
              const isEmbOrKnitOnly = keys.length > 0 && keys.every((k: string) => k === 'EMBROIDERY' || k === 'KNITWEAR')
              if (isEmbOrKnitOnly) return null // Skip this product entirely
            } catch {}

            // Attempt to use v2 images for better, context-aware thumbnails
            try {
              const v2 = await pf(`/v2/catalog-products/${p.id}/images${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`, locale)
              const arr: any[] = Array.isArray(v2?.data) ? v2.data : Array.isArray(v2?.result) ? v2.result : Array.isArray(v2) ? v2 : []
              type Item = { placement: string; image_url: string; background_image?: string | null; background_color?: string | null; _score?: number }
              const items: Item[] = arr.map((it: any) => ({
                placement: String(it.placement || it.view || it.view_name || it.side || it.type || '').toLowerCase(),
                image_url: it.image_url || it.url || it.image || it.preview_url || '',
                background_image: it.background_image || null,
                background_color: it.background_color || null,
              }))
              const scored = items.map((it) => {
                const url = it.image_url || ''
                let s = 0
                if (it.background_image) s += 3
                if (it.background_color) s += 1
                if (/^front$/.test(it.placement) || /front/.test(it.placement)) s += 2
                
                // Apply gender-specific scoring based on category context (not product title)
                if (genderContext === 'female') {
                  if (/(onwoman|womens|women\b)/i.test(url)) s += 10
                  if (/(onman\b|\bmen\b)/i.test(url)) s -= 5
                } else if (genderContext === 'male') {
                  if (/(onman\b|\bmen\b)/i.test(url)) s += 10
                  if (/(onwoman|womens|women\b)/i.test(url)) s -= 5
                } else {
                  // Unisex: prefer neutral
                  if (/(ghost|flat)/i.test(url)) s += 5
                }
                
                return { ...it, _score: s }
              })
              // prefer front images among ties
              scored.sort((a, b) => (b._score! - a._score!) || ((/front/.test(b.placement) ? 1 : 0) - (/front/.test(a.placement) ? 1 : 0)))
              const best = scored[0]
              if (best?.image_url) thumb = best.image_url
            } catch {}

            // Remove temporary placeholders
            if (thumb && /product_temporary_image\.jpg/.test(thumb)) {
              thumb = null
            }

            // Skip products without usable thumbnails
            if (!thumb) return null

            // Compute shipping availability for selected country (optional)
            let ships = true
            if (countryCode) {
              try {
                const sc = await pf(`/v2/catalog-products/${p.id}/shipping-countries`, locale)
                const list: any[] = (sc?.data || sc?.result || sc) as any[]
                ships = list.some((c: any) => String(c?.code || c?.country_code || '').toUpperCase() === countryCode)
              } catch {}
            }

            // Our selling price (preferred) or Printful fallback
            let price: string | null = null
            let currency = 'USD'
            let dbId: string | null = null
            
            // Map country codes to currencies
            const getCurrency = (countryCode: string) => {
              const currencyMap: Record<string, string> = {
                'US': 'USD',
                'CA': 'CAD', 
                'GB': 'GBP',
                'FR': 'EUR',
                'DE': 'EUR',
                'ES': 'EUR',
                'IT': 'EUR',
                'AU': 'AUD',
                'JP': 'JPY',
                'BR': 'BRL',
                'KR': 'KRW',
                'NZ': 'NZD',
                'LV': 'EUR'
              }
              return currencyMap[countryCode] || 'USD'
            }
            
            // First try our DB selling price
            try {
              const desiredCurrency = countryCode ? getCurrency(countryCode) : 'USD'
              const { data: row } = await supabase
                .from('products')
                .select('id, base_price_usd')
                .eq('printful_id', p.id)
                .limit(1)
              dbId = row?.[0]?.id || null
              const base = row?.[0]?.base_price_usd
              if (dbId && base != null) {
                const pricing = await calculateRetailPrice(Number(base), desiredCurrency, dbId)
                price = pricing.retailPrice.toFixed(2)
                currency = pricing.currency
              }
            } catch {}

            // DO NOT fallback to Printful price - we only show our selling price
            // If DB price is not available, price will remain null and badge won't show

            return { ...p, thumbnail: thumb, _ships: ships, price, currency, _db_id: dbId }
          } catch (e) {
            return null // Skip failed products
          }
        })
      )
      
      // Add non-null results to our processed list
      const validResults = batchResults.filter(Boolean)
      processedProducts.push(...validResults)
      processedCount += batch.length
      
      // Stop if we have enough products for the requested page
      if (processedProducts.length >= page * limit) break
    }

    // 3) Apply client-side sorting for price (v2 API price sorting may not work correctly)
    let sorted = [...processedProducts]
    
    // Always apply client-side price sorting since v2 API price sorting may not work correctly
    if (sortType === 'price') {
      sorted = sorted.sort((a, b) => {
        const aPrice = a.price ? parseFloat(a.price) : Infinity
        const bPrice = b.price ? parseFloat(b.price) : Infinity
        return aPrice - bPrice
      })
    } else if (!usedV2) {
      // Client-side sorting for v1 API fallback for other sort types
      switch (sortType) {
        case 'new':
          // Sort by ID (newer products typically have higher IDs)
          sorted = sorted.sort((a, b) => b.id - a.id)
          break
        case 'rating':
          // Sort by title as a fallback (no rating data available)
          sorted = sorted.sort((a, b) => a.title.localeCompare(b.title))
          break
        case 'bestseller':
        default:
          // Keep original order for bestseller
          break
      }
    }
    
    // 4) Sort to place non-shippable items last if country provided
    // This should be the final sort to ensure shipping availability is respected
    if (countryCode) {
      sorted = sorted.sort((a, b) => {
        // First sort by shipping availability (shippable first)
        const aShips = a._ships === true ? 0 : 1
        const bShips = b._ships === true ? 0 : 1
        if (aShips !== bShips) return aShips - bShips
        
        // If both have same shipping status, maintain the original sort order
        return 0
      })
    }

    // 5) Apply pagination to the filtered results
    const offset = (page - 1) * limit
    const paginatedResults = sorted.slice(offset, offset + limit)
    
    // 6) Estimate total filtered products based on filtering ratio
    const filteringRatio = processedProducts.length / processedCount
    const estimatedTotal = Math.round(allProducts.length * filteringRatio)
    
    // 7) Check if there are more pages
    const hasMore = estimatedTotal > offset + limit

    return NextResponse.json({ 
      result: paginatedResults, 
      page, 
      limit, 
      total: estimatedTotal,
      hasMore 
    })
  } catch (e: any) {
    console.error('[api/printful/products] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
