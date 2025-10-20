import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const locale = body.locale || 'en_US'
    
    console.log(`🚀 Starting SIMPLE sync for language: ${locale}`)
    
    // Just test the basic functionality without database
    const PRINTFUL_API_KEY = process.env.PRINTFUL_API_TOKEN
    const PRINTFUL_BASE_URL = 'https://api.printful.com'
    
    if (!PRINTFUL_API_KEY) {
      throw new Error('PRINTFUL_API_TOKEN not found')
    }
    
    // Test a simple API call
    const response = await fetch(`${PRINTFUL_BASE_URL}/categories`, {
      headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
    })
    
    if (!response.ok) {
      throw new Error(`Printful API failed: ${response.status}`)
    }
    
    const data = await response.json()
    const categories = data?.result?.categories || []
    
    return NextResponse.json({
      success: true,
      message: `Simple sync test completed for ${locale}`,
      categoriesFound: categories.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Simple sync error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
