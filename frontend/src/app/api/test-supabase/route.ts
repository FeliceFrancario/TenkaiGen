import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    console.log('🧪 Testing Supabase connection...')
    
    const supabase = await createServiceClient()
    console.log('✅ Supabase client created')
    
    const { data, error } = await supabase
      .from('categories')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 })
    }
    
    console.log('✅ Supabase query successful')
    
    return NextResponse.json({
      success: true,
      message: 'Supabase connection working',
      data: data
    })
    
  } catch (error: any) {
    console.error('❌ Test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
