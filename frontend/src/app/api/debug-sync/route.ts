import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Debug API called')
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))
    
    // Try to parse the body
    let body
    try {
      body = await request.json()
      console.log('Body parsed successfully:', body)
    } catch (parseError) {
      console.log('Body parse error:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse JSON body',
        details: parseError instanceof Error ? parseError.message : 'Unknown error'
      }, { status: 400 })
    }
    
    const locale = body.locale || 'en_US'
    
    return NextResponse.json({
      success: true,
      message: `Debug API working for locale: ${locale}`,
      body: body,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}