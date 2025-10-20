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
    const currency = searchParams.get('currency')
    const sellingRegion = searchParams.get('selling_region')
    if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const qs = new URLSearchParams()
    if (currency) qs.set('currency', currency)
    if (sellingRegion) qs.set('selling_region', sellingRegion)

    // Try v2 prices first with currency parameter
    try {
      const url = `/v2/catalog-products/${encodeURIComponent(productId)}/prices${qs.toString() ? `?${qs.toString()}` : ''}`
      const data = await pf(url)
      const result = data?.data || data?.result || data
      if (result && (Array.isArray(result) ? result.length > 0 : Object.keys(result).length > 0)) {
        return NextResponse.json({ result })
      }
      throw new Error('Empty v2 prices')
    } catch (e) {
      // Fallback to v1 products; compute minimal variant price
      const v1 = await pf(`/products/${encodeURIComponent(productId)}`)
      const v1res = (v1?.result || {}) as any
      const variants: any[] = Array.isArray(v1res.variants) ? v1res.variants : []
      let min = Infinity
      for (const v of variants) {
        const p = Number(v?.price ?? v?.retail_price)
        if (Number.isFinite(p)) min = Math.min(min, p)
      }
      if (min !== Infinity) {
        const cur = currency || (v1res?.currency as string) || 'USD'
        return NextResponse.json({ result: { price: { amount: min, currency: cur } } })
      }
      return NextResponse.json({ result: {} })
    }
  } catch (e: any) {
    console.error('[api/printful/prices] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
