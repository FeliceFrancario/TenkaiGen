import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Calculate shipping rates using Printful v2 Shipping Rates API
 * POST https://api.printful.com/v2/shipping-rates
 * @see https://developers.printful.com/docs/v2-beta/#tag/Shipping-Rates-v2
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const catalogVariantId = searchParams.get('catalog_variant_id')
    const countryCode = searchParams.get('country_code') || 'US'
    const stateCode = searchParams.get('state_code') || ''
    const zip = searchParams.get('zip') || ''
    const quantity = searchParams.get('quantity') || '1'

    if (!catalogVariantId) {
      return NextResponse.json({ error: 'catalog_variant_id is required' }, { status: 400 })
    }

    const token = process.env.PRINTFUL_API_TOKEN
    if (!token) {
      console.error('[shipping-rates] PRINTFUL_API_TOKEN not configured')
      return NextResponse.json({ error: 'API token not configured' }, { status: 500 })
    }

    // Determine currency based on country
    const getCurrency = (cc: string) => {
      const eurCountries = new Set(['AT','BE','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES'])
      if (cc === 'GB' || cc === 'UK') return 'GBP'
      if (eurCountries.has(cc)) return 'EUR'
      if (cc === 'CA') return 'CAD'
      if (cc === 'AU') return 'AUD'
      if (cc === 'JP') return 'JPY'
      if (cc === 'MX') return 'MXN'
      return 'USD'
    }
    
    const currency = getCurrency(countryCode.toUpperCase())

    // Build recipient object
    const recipient: any = {
      country_code: countryCode.toUpperCase()
    }
    if (stateCode) recipient.state_code = stateCode.toUpperCase()
    if (zip) recipient.zip = zip

    // Build request payload
    const payload = {
      recipient,
      order_items: [
        {
          source: 'catalog',
          catalog_variant_id: parseInt(catalogVariantId, 10),
          quantity: parseInt(quantity, 10)
        }
      ],
      locale: 'en_US',
      currency
    }

    console.log('[shipping-rates] Request payload:', JSON.stringify(payload, null, 2))

    const resp = await fetch('https://api.printful.com/v2/shipping-rates', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-PF-Store-Id': process.env.PRINTFUL_STORE_ID || ''
      },
      body: JSON.stringify(payload)
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[shipping-rates] Printful error', resp.status, errText)
      return NextResponse.json({ 
        success: false, 
        error: `Printful returned ${resp.status}`, 
        available: false 
      }, { status: resp.status })
    }

    const data = await resp.json()
    console.log('[shipping-rates] Printful response:', JSON.stringify(data, null, 2))
    
    // v2 response structure is { data: [...shipping_rates], extra: [] }
    // NOT { data: { shipping_rates: [...] } }
    const rates = Array.isArray(data?.data) ? data.data : []
    
    if (!rates || rates.length === 0) {
      // Empty rates might mean incomplete address (e.g., US needs state_code)
      // Return available: true but with empty rates so UI can handle it gracefully
      console.log('[shipping-rates] Empty rates returned')
      return NextResponse.json({ 
        success: true, 
        available: true, 
        rates: [],
        message: countryCode === 'US' && !stateCode ? 'State required for US shipping' : 'Select shipping options at checkout'
      })
    }
    
    console.log('[shipping-rates] Found', rates.length, 'shipping options')

    // Return the shipping options
    return NextResponse.json({ 
      success: true, 
      available: true, 
      rates: rates.map((r: any) => ({
        id: r.id,
        name: r.name,
        rate: r.rate,
        currency: r.currency || data?.data?.currency || 'USD',
        min_delivery_days: r.min_delivery_days,
        max_delivery_days: r.max_delivery_days,
        min_delivery_date: r.min_delivery_date,
        max_delivery_date: r.max_delivery_date
      }))
    })
  } catch (e: any) {
    console.error('[shipping-rates] error', e)
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'Internal error',
      available: false
    }, { status: 500 })
  }
}

