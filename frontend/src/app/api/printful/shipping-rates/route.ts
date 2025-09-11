import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string, init?: RequestInit) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Printful API ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { country_code, variant_id, currency, state_code } = body || {}
    if (!country_code || !variant_id) {
      return NextResponse.json({ error: 'country_code and variant_id are required' }, { status: 400 })
    }

    const v1payload: any = {
      recipient: { country_code },
      items: [
        {
          variant_id,
          quantity: 1,
        },
      ],
      ...(currency ? { currency } : {}),
    }
    if (state_code) v1payload.recipient.state_code = state_code

    try {
      const data = await pf('/shipping/rates', { method: 'POST', body: JSON.stringify(v1payload) })
      return NextResponse.json({ result: data?.result || data })
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (/State code is missing/i.test(msg)) {
        // Gracefully handle missing state for US; return empty rates so UI can message user
        return NextResponse.json({ result: [] })
      }
      throw e
    }
  } catch (e: any) {
    console.error('[api/printful/shipping-rates] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
