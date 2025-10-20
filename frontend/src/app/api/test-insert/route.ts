import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    console.log('🧪 Testing simple insert...')
    
    const supabase = await createServiceClient()
    
    // Test 1: Try to insert a simple provider
    const { data: providerData, error: providerError } = await supabase
      .from('providers')
      .insert({
        name: 'Test Provider',
        api_base_url: 'https://test.com'
      })
      .select()
      .single()
    
    console.log('Provider insert result:', { providerData, providerError })
    
    if (providerError) {
      return NextResponse.json({
        success: false,
        error: `Provider insert failed: ${providerError.message}`,
        details: providerError
      })
    }
    
    // Test 2: Try to insert a simple category
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .insert({
        provider_id: providerData.id,
        name: 'Test Category',
        slug: 'test-category'
      })
      .select()
      .single()
    
    console.log('Category insert result:', { categoryData, categoryError })
    
    if (categoryError) {
      return NextResponse.json({
        success: false,
        error: `Category insert failed: ${categoryError.message}`,
        details: categoryError
      })
    }
    
    // Test 3: Try to insert a simple product
    const { data: productData, error: productError } = await supabase
      .from('products')
      .insert({
        provider_id: providerData.id,
        category_id: categoryData.id,
        name: 'Test Product',
        slug: 'test-product',
        base_price_usd: 10.00
      })
      .select()
      .single()
    
    console.log('Product insert result:', { productData, productError })
    
    if (productError) {
      return NextResponse.json({
        success: false,
        error: `Product insert failed: ${productError.message}`,
        details: productError
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'All test inserts successful',
      data: {
        provider: providerData,
        category: categoryData,
        product: productData
      }
    })
    
  } catch (error: any) {
    console.error('❌ Test insert error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Test insert failed' 
      }, 
      { status: 500 }
    )
  }
}
