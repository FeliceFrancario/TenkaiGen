import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const token = process.env.PRINTFUL_API_TOKEN
    if (!token) {
      return NextResponse.json({ success: false, error: 'No Printful token' })
    }
    
    // Fetch categories from Printful API
    const response = await fetch('https://api.printful.com/v2/catalog-categories', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ 
        success: false, 
        error: `Printful API error: ${response.status} ${errorText}` 
      })
    }
    
    const data = await response.json()
    const categories = data?.data || []
    
    // Analyze the structure
    const analysis = {
      totalCategories: categories.length,
      rootCategories: categories.filter((cat: any) => !cat.parent_id).length,
      categoriesWithParents: categories.filter((cat: any) => cat.parent_id).length,
      sampleCategories: categories.slice(0, 10).map((cat: any) => ({
        id: cat.id,
        name: cat.name || cat.title,
        parent_id: cat.parent_id,
        hasParent: !!cat.parent_id
      })),
      parentChildMap: categories.reduce((acc: any, cat: any) => {
        if (cat.parent_id) {
          if (!acc[cat.parent_id]) acc[cat.parent_id] = []
          acc[cat.parent_id].push({
            id: cat.id,
            name: cat.name || cat.title
          })
        }
        return acc
      }, {})
    }
    
    return NextResponse.json({
      success: true,
      analysis,
      rawCategories: categories
    })
    
  } catch (error: any) {
    console.error('❌ Printful categories debug error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Debug failed' 
      }, 
      { status: 500 }
    )
  }
}
