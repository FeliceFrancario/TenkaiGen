import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServiceClient()
    
    // Get categories with product counts
    const { data: categories, error } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        slug,
        parent_id,
        image_url,
        printful_id,
        sort_order,
        is_featured
      `)
      .order('name')
    
    if (error) {
      console.error('Database categories error:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }
    
    // Get product counts separately to avoid complex joins
    const categoryIds = categories?.map(cat => cat.id) || []
    const { data: productCounts } = await supabase
      .from('products')
      .select('category_id')
      .in('category_id', categoryIds)
    
    // Count products per category
    const counts = productCounts?.reduce((acc: Record<string, number>, product) => {
      acc[product.category_id] = (acc[product.category_id] || 0) + 1
      return acc
    }, {}) || {}
    
    // Build a quick lookup from DB uuid to printful_id
    const idToPrintful: Record<string, number> = {}
    for (const c of categories || []) {
      if (c.printful_id != null) idToPrintful[c.id] = Number(c.printful_id)
    }

    // Transform to match current catalog format using Printful numeric IDs
    const transformedCategories = categories?.map(cat => ({
      id: idToPrintful[cat.id] ?? null,
      title: cat.name,
      image_url: cat.image_url || null,
      parent_id: cat.parent_id ? (idToPrintful[cat.parent_id] ?? null) : null,
      product_count: counts[cat.id] || 0
    })).filter(c => c.id !== null) || []
    
    return NextResponse.json({
      success: true,
      result: {
        categories: transformedCategories
      }
    })
    
  } catch (error: any) {
    console.error('Categories API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to fetch categories' 
    }, { status: 500 })
  }
}
