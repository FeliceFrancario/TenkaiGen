import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Test API called')
    
    return NextResponse.json({
      success: true,
      message: 'Test API working',
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}