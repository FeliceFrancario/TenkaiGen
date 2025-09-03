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
    const limit = Math.max(1, Math.min(24, Number(searchParams.get('limit') || '10')))

    const list = await pf('/store/products')
    const items: Array<{ id: number; name: string; thumbnail_url: string | null }> = list?.result || []
    const sliced = items.slice(0, limit)

    // Enrich each item with a reliable thumbnail and min price across variants
    const enriched = await Promise.all(
      sliced.map(async (p: any) => {
        try {
          const detail = await pf(`/store/products/${p.id}`)
          const syncVariants: any[] = Array.isArray(detail?.result?.sync_variants) ? detail.result.sync_variants : []
          const firstSync = syncVariants[0]
          const thumb = p.thumbnail_url || firstSync?.product?.image || null

          let min = Number.POSITIVE_INFINITY
          const currency: string | null = (detail?.result?.sync_product?.currency as string) || null
          for (const sv of syncVariants) {
            const rp = (sv?.retail_price ?? sv?.price ?? sv?.variant_retail_price) as string | number | undefined
            if (rp != null) {
              const n = parseFloat(String(rp))
              if (!Number.isNaN(n) && n < min) min = n
            }
          }
          const min_price = Number.isFinite(min) ? min : null
          return { id: p.id, name: p.name, thumbnail: thumb, min_price, currency }
        } catch (e) {
          return { id: p.id, name: p.name, thumbnail: p.thumbnail_url || null, min_price: null, currency: null }
        }
      })
    )

    return NextResponse.json({ result: enriched })
  } catch (e: any) {
    console.error('[api/printful/store-products] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
