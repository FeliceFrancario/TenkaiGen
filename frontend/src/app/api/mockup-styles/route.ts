import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

const GENDER_STYLE_MAPPING = {
  "Men's clothing": [
    "Men's 2", "Men's 3", "Men's 4", "Men's 5", 
    "Flat", "Flat 2", "Flat 3", "Flat Lifestyle",
    "Ghost", "Ghost 2"
  ],
  "Women's clothing": [
    "Women's 2", "Women's 3", "Women's 4", "Women's 5", "Women's 6",
    "Women's", "Women's Lifestyle",
    "Flat", "Flat 2", "Flat 3", "Flat Lifestyle", 
    "Ghost", "Ghost 2"
  ],
  "Unisex": [
    "Men's 2", "Women's 2", "Flat", "Flat Lifestyle", "Ghost"
  ]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const placement = searchParams.get('placement')
    const categoryName = searchParams.get('categoryName')
    
    if (!productId || !placement) {
      return NextResponse.json({
        success: false,
        error: 'productId and placement are required'
      }, { status: 400 })
    }
    
    const supabase = await createServiceClient()
    
    // Get mockup styles for the product and placement
    let query = supabase
      .from('mockup_styles')
      .select('*')
      .eq('product_id', productId)
      .eq('placement', placement)
    
    // Filter by category if provided
    if (categoryName && GENDER_STYLE_MAPPING[categoryName]) {
      const allowedCategories = GENDER_STYLE_MAPPING[categoryName]
      query = query.in('category_name', allowedCategories)
    }
    
    const { data: mockupStyles, error } = await query
    
    if (error) {
      console.error('Error fetching mockup styles:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }
    
    // Group by category for easier frontend consumption
    const groupedStyles = mockupStyles.reduce((acc, style) => {
      if (!acc[style.category_name]) {
        acc[style.category_name] = []
      }
      acc[style.category_name].push(style)
      return acc
    }, {})
    
    return NextResponse.json({
      success: true,
      data: {
        mockupStyles: groupedStyles,
        styleIds: mockupStyles.map(s => s.style_id),
        total: mockupStyles.length
      }
    })
    
  } catch (error) {
    console.error('Mockup styles API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
