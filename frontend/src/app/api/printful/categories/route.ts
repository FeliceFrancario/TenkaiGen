import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

export async function GET() {
  try {
    const token = process.env.PRINTFUL_API_TOKEN
    if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
    const res = await fetch(`${PRINTFUL_API_BASE}/categories`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Printful API /categories failed: ${res.status} ${text}`)
    }
    const json = await res.json()
    return NextResponse.json(json)
  } catch (e: any) {
    console.error('[api/printful/categories] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
