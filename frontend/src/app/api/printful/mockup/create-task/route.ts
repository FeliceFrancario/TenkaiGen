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
    const productId = body?.product_id || body?.id
    if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    // Pass-through fields: variant_ids, format, width, product_options, option_groups, options, files, product_template_id
    const payload: any = {
      variant_ids: body?.variant_ids || [],
      format: body?.format || 'png',
      width: body?.width || 1000,
      product_options: body?.product_options || {},
      option_groups: body?.option_groups || undefined,
      options: body?.options || undefined,
      files: body?.files || undefined,
      product_template_id: body?.product_template_id || undefined,
    }

    const data = await pf(`/mockup-generator/create-task/${encodeURIComponent(productId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const result = data?.result || data
    return NextResponse.json({ result })
  } catch (e: any) {
    console.error('[api/printful/mockup/create-task] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
