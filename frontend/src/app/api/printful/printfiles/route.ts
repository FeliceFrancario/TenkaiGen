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
    const technique = searchParams.get('technique') || undefined
    if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const qs = new URLSearchParams()
    if (technique) qs.set('technique', technique)
    const data = await pf(`/mockup-generator/printfiles/${encodeURIComponent(productId)}${qs.size ? `?${qs}` : ''}`)
    const result = data?.result || data?.data || data
    return NextResponse.json({ result })
  } catch (e: any) {
    console.error('[api/printful/printfiles] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
