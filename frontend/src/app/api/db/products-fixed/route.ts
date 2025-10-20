import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

// Manual category mapping that replicates your current working catalog
const CATEGORY_MAPPING = {
  // Top-level categories (like your current TOP_TITLES)
  "Men's clothing": {
    id: "9a218b52-6251-4cc1-bb01-e986a8fe24f6",
    subcategories: ["T-shirts", "Tank tops", "Long sleeve shirts", "Hoodies", "Sweatshirts"]
  },
  "Women's clothing": {
    id: "befa24e0-df70-4fc9-aa0e-c2a459993a34", 
    subcategories: ["T-shirts", "Tank tops", "Dresses", "Hoodies", "Sweatshirts"]
  },
  "Kids' & youth clothing": {
    id: "8acca3e5-1e3a-48c8-aade-6942ad20367e",
    subcategories: ["T-shirts", "Tank tops", "Bodysuits"]
  },
  "Hats": {
    id: "d7be6a11-cb9e-46c2-a5ba-211550f9c2bf",
    subcategories: ["Snapbacks", "Beanies", "Baseball caps"]
  },
  "Accessories": {
    id: "24f11c8d-7949-4ad3-af38-ffcb9be24852",
    subcategories: ["Bags", "Totes", "Backpacks"]
  },
  "Home & living": {
    id: "9118e3fd-0bb2-4858-a871-5d600a638c15",
    subcategories: ["Posters", "Canvas prints", "Mugs", "Towels"]
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const currency = searchParams.get('currency') || 'USD'
    const limit = Number(searchParams.get('limit') || '24')
    const offset = Number(searchParams.get('offset') || '0')
    
    const supabase = await createServiceClient()
    
    // Get products for the specific category
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        description,
        slug,
        base_price_usd,
        thumbnail_url,
        category_id
      `)
      .eq('category_id', categoryId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Database products error:', error)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
    
    // Transform products to match your current catalog format
    const transformedProducts = products?.map(product => {
      // Calculate retail price with 20% markup
      const retailPrice = product.base_price_usd * 1.2
      
      return {
        id: product.id,
        title: product.name,
        main_category_id: product.category_id,
        thumbnail: product.thumbnail_url,
        price: retailPrice.toFixed(2),
        currency: currency,
        formatted_price: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency,
        }).format(retailPrice),
        _ships: true,
        description: product.description
      }
    }) || []
    
    // Get total count
    const { count } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId)
    
    return NextResponse.json({
      success: true,
      result: transformedProducts,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    })
    
  } catch (error: any) {
    console.error('Products API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to fetch products' 
    }, { status: 500 })
  }
}
