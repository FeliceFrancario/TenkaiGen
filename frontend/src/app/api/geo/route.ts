import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('cf-ipcountry') ||
      req.headers.get('x-country-code') ||
      'US'
    const region =
      req.headers.get('x-vercel-ip-country-region') ||
      req.headers.get('x-region-code') ||
      ''

    // Fallback: infer country from Accept-Language (e.g., it-IT,it;q=0.9)
    let countryCode = country
    if (!countryCode || countryCode === 'US') {
      const al = req.headers.get('accept-language') || ''
      // Take first locale
      const first = al.split(',')[0]?.trim() || ''
      const m = /-([A-Za-z]{2})/.exec(first)
      if (m && m[1]) countryCode = m[1].toUpperCase()
    }
    return NextResponse.json({ countryCode, regionCode: region })
  } catch (e: any) {
    return NextResponse.json({ countryCode: 'US', regionCode: '' })
  }
}
