import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'
import { calculateRetailPrice } from '@/lib/pricing'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('product_id')
    const currency = (searchParams.get('currency') || 'USD').toUpperCase()
    const region = (searchParams.get('region') || 'global').toLowerCase()
    if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    const supabase = await createServiceClient()

    // Try cached
    const { data: cached } = await supabase
      .from('product_prices')
      .select('selling_price, includes_design')
      .eq('product_id', productId)
      .eq('currency', currency)
      .eq('region', region)
      .maybeSingle()

    if (cached?.selling_price != null) {
      return NextResponse.json({
        success: true,
        result: { price: cached.selling_price, currency, includes_design: cached.includes_design !== false }
      })
    }

    // Compute
    const { data: product } = await supabase
      .from('products')
      .select('id, base_price_usd')
      .eq('id', productId)
      .maybeSingle()

    if (!product) return NextResponse.json({ error: 'product not found' }, { status: 404 })

    const pricing = await calculateRetailPrice(Number(product.base_price_usd), currency, productId)

    // Cache
    await supabase
      .from('product_prices')
      .upsert({
        product_id: productId,
        currency,
        region,
        selling_price: pricing.retailPrice,
        includes_design: true,
        exchange_rate_used: pricing.exchangeRateUsed,
        source: 'calculated'
      }, { onConflict: 'product_id,currency,region' }).then(({ error }) => {
        if (error) console.error('product_prices upsert error', error)
      }).catch((e) => console.error('product_prices upsert threw', e))

    return NextResponse.json({ success: true, result: { price: pricing.retailPrice, currency, includes_design: true } })
  } catch (e: any) {
    console.error('[api/db/price] error', e)
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 })
  }
}
