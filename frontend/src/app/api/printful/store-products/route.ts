import { NextResponse } from 'next/server'

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

export async function GET() {
  try {
    const list = await pf('/store/products')
    const items: Array<{ id: number; name: string; thumbnail_url: string | null }> = list?.result || []

    // If thumbnail_url is null, try to fetch first variant image from details
    const enriched = await Promise.all(
      items.map(async (p: any) => {
        if (p.thumbnail_url) return { id: p.id, name: p.name, thumbnail: p.thumbnail_url }
        try {
          const detail = await pf(`/store/products/${p.id}`)
          const firstSync = (detail?.result?.sync_variants || [])[0]
          const fallback = firstSync?.product?.image || null
          return { id: p.id, name: p.name, thumbnail: fallback }
        } catch (e) {
          return { id: p.id, name: p.name, thumbnail: null }
        }
      })
    )

    return NextResponse.json({ result: enriched })
  } catch (e: any) {
    console.error('[api/printful/store-products] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
