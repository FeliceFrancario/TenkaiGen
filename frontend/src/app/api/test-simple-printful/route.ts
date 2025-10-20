import { NextRequest, NextResponse } from 'next/server'

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_TOKEN
const PRINTFUL_BASE_URL = 'https://api.printful.com'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Printful API...')
    console.log('API Key exists:', !!PRINTFUL_API_KEY)
    console.log('API Key length:', PRINTFUL_API_KEY?.length || 0)
    
    if (!PRINTFUL_API_KEY) {
      return NextResponse.json({ success: false, error: 'PRINTFUL_API_TOKEN not found' }, { status: 500 })
    }

    const response = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-products?limit=5`, {
      headers: { 
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`
      }
    })
    
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('Error response:', errorText)
      return NextResponse.json({ 
        success: false, 
        error: `API failed: ${response.status}`,
        details: errorText
      }, { status: response.status })
    }
    
    const data = await response.json()
    console.log('Response keys:', Object.keys(data))
    console.log('Data field exists:', !!data.data)
    console.log('Data length:', data.data?.length || 0)
    
    return NextResponse.json({
      success: true,
      responseKeys: Object.keys(data),
      hasData: !!data.data,
      dataLength: data.data?.length || 0,
      firstProduct: data.data?.[0] || null
    })
    
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
