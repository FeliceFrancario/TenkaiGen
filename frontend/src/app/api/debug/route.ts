import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test 1: Check if provider exists
    const supabase = await createServiceClient()
    console.log('✅ Supabase client created')
    
    const { data: providers, error: providerError } = await supabase
      .from('providers')
      .select('*')
    
    console.log('Providers query result:', { providers, providerError })
    
    // Test 2: Check categories
    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select('*')
    
    console.log('Categories query result:', { categories, categoryError })
    
    // Test 3: Check products
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
    
    console.log('Products query result:', { products, productError })
    
    // Test 4: Test Printful API directly
    const token = process.env.PRINTFUL_API_TOKEN
    console.log('Printful token exists:', !!token)
    
    if (token) {
      try {
        const response = await fetch('https://api.printful.com/v2/catalog-categories', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('Printful API response:', data)
        } else {
          console.error('Printful API error:', response.status, await response.text())
        }
      } catch (apiError) {
        console.error('Printful API fetch error:', apiError)
      }
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        providers: providers?.length || 0,
        categories: categories?.length || 0,
        products: products?.length || 0,
        providerError: providerError?.message,
        categoryError: categoryError?.message,
        productError: productError?.message
      }
    })
  } catch (error: any) {
    console.error('❌ Debug API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Debug failed' 
      }, 
      { status: 500 }
    )
  }
}
