import { NextRequest, NextResponse } from 'next/server'
import { syncPrintfulData } from '@/lib/fast-sync'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { locale } = await req.json().catch(() => ({}))
    
    console.log('🔄 Starting Printful sync via API...')
    await syncPrintfulData(locale)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Printful sync completed successfully' 
    })
  } catch (error: any) {
    console.error('❌ Sync API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Sync failed' 
      }, 
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST to trigger Printful sync',
    endpoint: '/api/sync/printful'
  })
}
