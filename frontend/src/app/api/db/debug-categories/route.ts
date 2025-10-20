import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServiceClient()

    const { data: providers } = await supabase
      .from('providers')
      .select('id,name')
      .eq('name', 'Printful')
      .limit(1)

    const providerId = providers?.[0]?.id || null

    const { data: cats, error } = await supabase
      .from('categories')
      .select('*')
      .order('name')
      .limit(50)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, providerId, catsCount: cats?.length || 0, cats })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

