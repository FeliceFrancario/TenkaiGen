import { NextRequest, NextResponse } from 'next/server'

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_TOKEN
const PRINTFUL_BASE_URL = 'https://api.printful.com'

export async function GET(request: NextRequest) {
  try {
    if (!PRINTFUL_API_KEY) {
      return NextResponse.json({ success: false, error: 'PRINTFUL_API_TOKEN not found' }, { status: 500 })
    }

    console.log('Testing Printful v2 API...')
    
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
    console.log('Response structure:', Object.keys(data))
    console.log('Result structure:', data?.result ? Object.keys(data.result) : 'No result')
    console.log('Data structure:', data?.data ? Object.keys(data.data) : 'No data')
    
    return NextResponse.json({
      success: true,
      responseKeys: Object.keys(data),
      resultKeys: data?.result ? Object.keys(data.result) : null,
      dataKeys: data?.data ? Object.keys(data.data) : null,
      sampleData: data
    })
    
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
