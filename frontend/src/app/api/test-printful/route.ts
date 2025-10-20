import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    console.log('🧪 Testing Printful API connection...')
    
    const token = process.env.PRINTFUL_API_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'Missing PRINTFUL_API_TOKEN' }, { status: 500 })
    }
    
    console.log('✅ Token found, testing API call...')
    
    const response = await fetch('https://api.printful.com/v2/catalog-products?limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-PF-Language': 'en_US'
      },
      cache: 'no-store'
    })
    
    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json({ 
        error: `Printful API failed: ${response.status} ${text}` 
      }, { status: 500 })
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      productCount: data?.data?.length || 0,
      firstProduct: data?.data?.[0] || null,
      message: 'Printful API connection successful'
    })
    
  } catch (error: any) {
    console.error('❌ Test error:', error)
    return NextResponse.json({ 
      error: error.message || 'Test failed' 
    }, { status: 500 })
  }
}
