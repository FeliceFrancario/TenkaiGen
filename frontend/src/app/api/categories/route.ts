import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const providerId = searchParams.get('provider_id')
    
    // Import the createServiceClient function
    const { createServiceClient } = await import('@/lib/database')
    const supabase = await createServiceClient()
    
    let query = supabase
      .from('categories')
      .select(`
        *,
        products(count)
      `)
      .order('name')
    
    if (providerId) {
      query = query.eq('provider_id', providerId)
    }
    
    const { data: categories, error } = await query
    
    if (error) {
      console.error('Error fetching categories:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error: any) {
    console.error('❌ Categories API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch categories' 
      }, 
      { status: 500 }
    )
  }
}
