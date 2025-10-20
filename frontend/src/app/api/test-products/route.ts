import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    
    console.log('🧪 Testing products API with category:', categoryId)
    
    const supabase = await createServiceClient()
    
    // Simple query to test
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, base_price_usd, category_id')
      .eq('category_id', categoryId)
      .limit(3)
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    console.log('✅ Products found:', products?.length || 0)
    
    return NextResponse.json({
      success: true,
      categoryId,
      productCount: products?.length || 0,
      products: products?.map(p => ({
        id: p.id,
        name: p.name,
        price: p.base_price_usd,
        category: p.category_id
      })) || []
    })
    
  } catch (error: any) {
    console.error('Test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
