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
    const data = await pf(`/v2/catalog-products/${encodeURIComponent(productId)}/mockup-templates`)
    return NextResponse.json({ result: data?.data || data?.result || data })
  } catch (e: any) {
    console.error('[api/printful/mockup-templates] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
