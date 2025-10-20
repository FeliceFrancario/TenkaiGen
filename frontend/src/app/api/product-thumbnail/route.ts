import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/**
 * GET /api/product-thumbnail
 * Returns gender-appropriate thumbnail URL for a product
 * 
 * Query params:
 * - product_id: UUID or printful_id of the product
 * - gender: 'male' | 'female' | 'unisex' (defaults to 'unisex')
 * - placement: 'front' | 'back' | 'embroidery_front' etc (defaults to 'front')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    const genderPref = searchParams.get('gender') || 'unisex'
    const placement = searchParams.get('placement') || 'front'

    if (!productId) {
      return NextResponse.json({ error: 'product_id required' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Resolve to UUID if numeric printful_id provided
    let dbId = productId
    if (!productId.includes('-')) {
      // It's a numeric Printful ID
      const { data: products } = await supabase
        .from('products')
        .select('id')
        .eq('printful_id', parseInt(productId, 10))
        .limit(1)
      
      if (!products || products.length === 0) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      
      dbId = products[0].id
    }

    // Fetch mockup styles for this product, ordered by gender preference
    const categoryPreference = 
      genderPref === 'male' ? ["Men's", "Mens", "Male", "Flat", "Ghost", "Women's", "Womens", "Female", "Couple's"] :
      genderPref === 'female' ? ["Women's", "Womens", "Female", "Flat", "Ghost", "Men's", "Mens", "Male", "Couple's"] :
      ["Flat", "Ghost", "Men's", "Mens", "Male", "Women's", "Womens", "Female", "Couple's"]

    const { data: mockupStyles } = await supabase
      .from('mockup_styles')
      .select('style_id, category_name, view_name, placement')
      .eq('product_id', dbId)
      .eq('placement', placement)
      .order('style_id')

    if (!mockupStyles || mockupStyles.length === 0) {
      // Fallback: try to get from images table
      const { data: images } = await supabase
        .from('images')
        .select('url')
        .eq('product_id', dbId)
        .eq('type', 'mockup')
        .limit(1)
      
      if (images && images.length > 0) {
        return NextResponse.json({ 
          success: true, 
          thumbnail: images[0].url,
          source: 'images_fallback'
        })
      }

      return NextResponse.json({ error: 'No images found' }, { status: 404 })
    }

    // Sort mockup styles by gender preference
    const sorted = mockupStyles.sort((a, b) => {
      const aIdx = categoryPreference.findIndex(cat => 
        a.category_name?.toLowerCase().includes(cat.toLowerCase())
      )
      const bIdx = categoryPreference.findIndex(cat => 
        b.category_name?.toLowerCase().includes(cat.toLowerCase())
      )
      
      const aRank = aIdx === -1 ? 999 : aIdx
      const bRank = bIdx === -1 ? 999 : bIdx
      
      return aRank - bRank
    })

    const preferredStyle = sorted[0]

    // Generate mockup URL using Printful's mockup generator pattern
    // For now, we'll use the images table to find actual mockup URLs
    const { data: images } = await supabase
      .from('images')
      .select('url')
      .eq('product_id', dbId)
      .eq('type', 'mockup')
      .limit(10) // Get several to try to find gender-appropriate one

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No mockup images found' }, { status: 404 })
    }

    // Try to find an image that matches the preferred category
    const matchedImage = images.find(img => {
      const url = img.url.toLowerCase()
      // Check if URL contains gender indicators
      if (genderPref === 'male' && (url.includes('male') || url.includes('mens') || url.includes('man'))) {
        return true
      }
      if (genderPref === 'female' && (url.includes('female') || url.includes('womens') || url.includes('woman'))) {
        return true
      }
      // Check for flat/ghost as neutral
      if (url.includes('flat') || url.includes('ghost')) {
        return true
      }
      return false
    })

    const thumbnail = matchedImage?.url || images[0].url

    return NextResponse.json({
      success: true,
      thumbnail,
      style_id: preferredStyle.style_id,
      category_name: preferredStyle.category_name,
      view_name: preferredStyle.view_name,
      source: matchedImage ? 'gender_matched' : 'first_available'
    })

  } catch (error) {
    console.error('[product-thumbnail] Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

