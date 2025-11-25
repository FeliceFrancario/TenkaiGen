import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/database'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const cookieStore = cookies()
    const clientToken = cookieStore.get('tg_client')?.value
    if (!clientToken) {
      return NextResponse.json({ error: 'No client token' }, { status: 400 })
    }
    const svc = await createServiceClient()
    const { error } = await svc
      .from('generation_jobs')
      .update({ user_id: user.id })
      .is('user_id', null)
      .contains('metadata', { client_token: clientToken } as any)

    if (error) {
      return NextResponse.json({ error: 'Failed to claim jobs' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to claim' }, { status: 500 })
  }
}


