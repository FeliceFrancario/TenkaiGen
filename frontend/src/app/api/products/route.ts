import { NextRequest, NextResponse } from 'next/server'
import { getProductsWithPricing } from '@/lib/pricing'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const currency = searchParams.get('currency') || 'USD'
    const limit = Number(searchParams.get('limit') || '24')
    const offset = Number(searchParams.get('offset') || '0')
    
    console.log(`📦 Fetching products: category=${categoryId}, currency=${currency}, limit=${limit}, offset=${offset}`)
    
    const products = await getProductsWithPricing(
      categoryId || undefined,
      currency,
      limit,
      offset
    )
    
    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        limit,
        offset,
        hasMore: products.length === limit
      }
    })
  } catch (error: any) {
    console.error('❌ Products API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to fetch products' 
      }, 
      { status: 500 }
    )
  }
}
