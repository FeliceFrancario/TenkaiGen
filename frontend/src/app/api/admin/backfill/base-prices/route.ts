import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'
import { calculateRetailPrice } from '@/lib/pricing'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  })
  if (!res.ok) return null
  return res.json().catch(() => null)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServiceClient()
    const { searchParams } = new URL(req.url)
    const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || '100')))

    const { data: rows } = await supabase
      .from('products')
      .select('id, printful_id')
      .or('base_price_usd.is.null,base_price_usd.eq.0')
      .limit(limit)

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'No products with base_price_usd = 0' })
    }

    let updated = 0
    for (const r of rows) {
      const pid = r.printful_id
      if (!pid) continue
      try {
        const detail = await pf(`/products/${pid}`)
        if (!detail) continue
        const variants: any[] = Array.isArray(detail?.result?.variants) ? detail.result.variants : []
        let min = Number.POSITIVE_INFINITY
        for (const v of variants) {
          const raw = v?.price ?? v?.retail_price
          const n = parseFloat(String(raw ?? '0'))
          if (Number.isFinite(n) && n > 0 && n < min) min = n
        }
        if (Number.isFinite(min) && min > 0) {
          await supabase
            .from('products')
            .update({ base_price_usd: min, updated_at: new Date().toISOString() })
            .eq('id', r.id)
          updated++

          // Seed product_prices for common currencies
          const currencies = ['USD','EUR','GBP']
          for (const cur of currencies) {
            const pr = await calculateRetailPrice(min, cur, r.id)
            await supabase
              .from('product_prices')
              .upsert({
                product_id: r.id,
                currency: pr.currency,
                region: 'global',
                selling_price: pr.retailPrice,
                includes_design: true,
                exchange_rate_used: pr.exchangeRateUsed,
                source: 'calculated'
              }, { onConflict: 'product_id,currency,region' })
          }
        }
      } catch {}
      // Gentle rate limit
      await new Promise(res => setTimeout(res, 150))
    }

    return NextResponse.json({ success: true, updated, scanned: rows.length })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}


