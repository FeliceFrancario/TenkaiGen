import { NextRequest, NextResponse } from 'next/server'
import { optimizedSync } from '@/lib/optimized-sync'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting debug sync...')
    
    // Test the fetchAllProductsOptimized function directly
    const PRINTFUL_API_KEY = process.env.PRINTFUL_API_TOKEN
    const PRINTFUL_BASE_URL = 'https://api.printful.com'
    
    if (!PRINTFUL_API_KEY) {
      return NextResponse.json({ success: false, error: 'PRINTFUL_API_TOKEN not found' }, { status: 500 })
    }
    
    console.log('Testing API call...')
    const response = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-products?limit=5`, {
      headers: { 
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
      }
    })
    
    if (!response.ok) {
      return NextResponse.json({ success: false, error: `API failed: ${response.status}` }, { status: response.status })
    }
    
    const data = await response.json()
    console.log('API Response keys:', Object.keys(data))
    console.log('Data field exists:', !!data.data)
    console.log('Data length:', data.data?.length || 0)
    
    const products = data?.data || []
    console.log('Products found:', products.length)
    
    if (products.length > 0) {
      console.log('First product:', products[0])
    }
    
    return NextResponse.json({
      success: true,
      responseKeys: Object.keys(data),
      hasData: !!data.data,
      dataLength: data.data?.length || 0,
      productsFound: products.length,
      firstProduct: products[0] || null
    })
    
  } catch (error) {
    console.error('Debug sync error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
