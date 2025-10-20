import { NextRequest, NextResponse } from 'next/server'
import { optimizedSync } from '@/lib/optimized-sync'

export async function POST(request: NextRequest) {
  try {
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is fine
    }
    const locale = (body as any).locale || 'en_US'
    
    console.log(`🚀 Starting optimized sync for locale: ${locale}`)
    
    // Run the optimized sync
    await optimizedSync(locale)
    
    return NextResponse.json({
      success: true,
      message: `Optimized sync completed for ${locale}`,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Optimized sync error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
