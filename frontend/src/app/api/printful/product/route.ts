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

    const detail = await pf(`/products/${encodeURIComponent(productId)}`)
    const result = detail?.result || {}
    const product = result.product || {}
    const variants = Array.isArray(result.variants) ? result.variants : []

    // Normalize minimal shape for the client
    const normalized = {
      id: product.id,
      title: product.title || product.name || 'Product',
      description: product.description || '',
      brand: product.brand || null,
      model: product.model || null,
      sizes: (product.sizes || []).map((s: any) => (typeof s === 'string' ? s : s?.size || s)).filter(Boolean),
      colors: (product.colors || []).map((c: any) => ({
        name: c?.name || c?.title || String(c || ''),
        value: c?.value || c?.code || null,
      })),
      variants: variants.map((v: any) => ({
        id: v.id,
        name: v.name || v.title || '',
        size: v.size || v.size_code || null,
        color: v.color || v.color_name || null,
        color_code: v.color_code || v.color_hex || null,
        image: v.image || v.files?.[0]?.preview_url || null,
      })),
      image: product.image || null,
    }

    return NextResponse.json({ result: normalized })
  } catch (e: any) {
    console.error('[api/printful/product] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
