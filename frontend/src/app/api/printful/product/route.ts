import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 3600 }, // Cache for 1 hour
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
    const productId = searchParams.get('product_id')
    if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const detail = await pf(`/products/${encodeURIComponent(productId)}`)
    const result = detail?.result || {}
    const product = result.product || {}
    const variants = Array.isArray(result.variants) ? result.variants : []

    // Normalize minimal shape for the client
    const catalogProductId = (product as any)?.product_id
      || (variants?.[0] as any)?.product?.product_id
      || (variants?.[0] as any)?.product?.id
      || null

    // Fetch v2 catalog variant IDs for shipping
    let v2Variants: any[] = []
    if (catalogProductId) {
      try {
        const v2data = await pf(`/v2/catalog-products/${catalogProductId}/catalog-variants`)
        v2Variants = (v2data?.data || []) as any[]
      } catch {}
    }

    // Try to find DB product id by v2 catalog printful_id
    let _db_id: string | null = null
    try {
      const supabase = await createServiceClient()
      const { data } = await supabase
        .from('products')
        .select('id')
        .eq('printful_id', catalogProductId)
        .limit(1)
      _db_id = data?.[0]?.id || null
    } catch {}

    const normalized = {
      id: product.id,
      catalog_product_id: catalogProductId,
      title: product.title || product.name || 'Product',
      description: product.description || '',
      brand: product.brand || null,
      model: product.model || null,
      // Include main_category_id for breadcrumb construction on product page
      main_category_id: product.main_category_id || (result as any)?.main_category_id || null,
      _db_id,
      sizes: (product.sizes || []).map((s: any) => (typeof s === 'string' ? s : s?.size || s)).filter(Boolean),
      colors: (product.colors || []).map((c: any) => ({
        name: c?.name || c?.title || String(c || ''),
        value: c?.value || c?.code || null,
      })),
      variants: variants.map((v: any) => {
        // Try to match v2 catalog variant by size/color
        const v2match = v2Variants.find((v2: any) => 
          String(v2?.size || '').toLowerCase() === String(v?.size || v?.size_code || '').toLowerCase() &&
          String(v2?.color || '').toLowerCase() === String(v?.color || v?.color_name || '').toLowerCase()
        )
        return {
          id: v.id,
          catalog_variant_id: v2match?.id || null,
          name: v.name || v.title || '',
          size: v.size || v.size_code || null,
          color: v.color || v.color_name || null,
          color_code: v.color_code || v.color_hex || null,
          image: v.image || v.files?.[0]?.preview_url || null,
          price: v.price ?? v.retail_price ?? null,
          currency: (result as any)?.currency || null,
        }
      }),
      image: product.image || null,
    }

    return NextResponse.json({ result: normalized })
  } catch (e: any) {
    console.error('[api/printful/product] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
