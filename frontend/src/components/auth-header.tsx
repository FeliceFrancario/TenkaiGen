"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'

export function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setEmail(data.user?.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => { mounted = false; sub.subscription?.unsubscribe() }
  }, [])

  if (email) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/cart" className="px-3 py-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 text-sm">Cart</Link>
        <span className="hidden sm:inline text-white/80 text-sm">{email}</span>
        <button
          onClick={async () => { const s = createClient(); await s.auth.signOut() }}
          className="px-3 py-1.5 rounded-full bg-white text-black text-sm hover:opacity-90"
        >Sign out</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/signin" className="px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition text-sm">Sign In</Link>
      <Link href="/signup" className="px-4 py-2 rounded-full bg-white text-black hover:opacity-90 transition text-sm">Sign Up</Link>
    </div>
  )
}
