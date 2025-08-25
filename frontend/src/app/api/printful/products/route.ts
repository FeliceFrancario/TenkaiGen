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
    const categoryId = searchParams.get('category_id')
    const limit = Number(searchParams.get('limit') || '8')

    if (!categoryId) {
      return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
    }

    // 1) Get catalog products by category
    const list = await pf(`/products?category_id=${encodeURIComponent(categoryId)}&limit=${limit}`)
    const products: Array<{ id: number; title: string; main_category_id: number }> = (list?.result || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      main_category_id: p.main_category_id,
    }))

    // 2) For each, fetch details to pick a variant image as thumbnail
    const detailed = await Promise.all(
      products.map(async (p) => {
        try {
          const detail = await pf(`/products/${p.id}`)
          const firstVariant = (detail?.result?.variants || [])[0]
          const thumb = firstVariant?.image || null
          return { ...p, thumbnail: thumb }
        } catch (e) {
          return { ...p, thumbnail: null }
        }
      })
    )

    return NextResponse.json({ result: detailed })
  } catch (e: any) {
    console.error('[api/printful/products] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
