import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

// Simple pricing utility that works with your current catalog
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const basePriceUsd = parseFloat(searchParams.get('base_price_usd') || '0')
    const currency = searchParams.get('currency') || 'USD'
    
    if (basePriceUsd <= 0) {
      return NextResponse.json({ error: 'Invalid base price' }, { status: 400 })
    }
    
    // Get exchange rate
    const supabase = await createServiceClient()
    const { data: rateData } = await supabase
      .from('exchange_rates')
      .select('rate_to_usd')
      .eq('currency', currency)
      .single()
    
    const exchangeRate = rateData?.rate_to_usd || 1.0
    
    // Apply 20% markup (default)
    const markupMultiplier = 1.2
    const retailPrice = basePriceUsd * markupMultiplier * exchangeRate
    
    return NextResponse.json({
      success: true,
      basePriceUsd,
      currency,
      exchangeRate,
      markupMultiplier,
      retailPrice: parseFloat(retailPrice.toFixed(2)),
      formattedPrice: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(retailPrice)
    })
    
  } catch (error: any) {
    console.error('Pricing API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Pricing calculation failed' 
    }, { status: 500 })
  }
}
