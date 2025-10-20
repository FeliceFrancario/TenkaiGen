import { NextRequest, NextResponse } from 'next/server'
import { updateExchangeRates } from '@/lib/exchange-rates'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Updating exchange rates via API...')
    await updateExchangeRates()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Exchange rates updated successfully' 
    })
  } catch (error: any) {
    console.error('❌ Exchange rates API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update exchange rates' 
      }, 
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST to update exchange rates',
    endpoint: '/api/exchange-rates'
  })
}
