import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
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
    const productId = searchParams.get('product_id')
    if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    try {
      const data = await pf(`/v2/catalog-products/${encodeURIComponent(productId)}/variants`)
      const arr: any[] = (data?.data || data?.result || data) as any[]
      const result = arr.map((v: any) => ({
        catalog_variant_id: v.id || v.catalog_variant_id || v.variant_id || null,
        variant_id: v.variant_id || null,
        size: v.size || v.size_code || v.attributes?.size || null,
        color: v.color || v.color_name || v.attributes?.color || null,
        name: v.name || v.title || '',
      }))
      return NextResponse.json({ result })
    } catch (e: any) {
      // Fallback to v1 products detail (variant list)
      const v1 = await pf(`/products/${encodeURIComponent(productId)}`)
      const v1res = (v1?.result || {}) as any
      const arr: any[] = Array.isArray(v1res.variants) ? v1res.variants : []
      const result = arr.map((v: any) => ({
        catalog_variant_id: null,
        variant_id: v.id,
        size: v.size || v.size_code || null,
        color: v.color || v.color_name || null,
        name: v.name || v.title || '',
      }))
      return NextResponse.json({ result })
    }
  } catch (e: any) {
    console.error('[api/printful/variants] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
