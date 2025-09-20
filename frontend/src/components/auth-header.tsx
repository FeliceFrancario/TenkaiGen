"use client"

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'
import { ShoppingCart, ChevronDown, User2 } from 'lucide-react'

export function AuthHeader() {
  const [user, setUser] = useState<{ email: string | null; name: string | null } | null>(null)
  const [open, setOpen] = useState(false)
  const supabase = createClient()
  const ref = useRef<HTMLDivElement | null>(null)
  const [cartCount, setCartCount] = useState<number>(0)

  useEffect(() => {
    let mounted = true
    const sync = async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      const u = data.user
      setUser(u ? { email: u.email ?? null, name: (u.user_metadata?.name as string | undefined) ?? null } : null)
    }
    sync()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user
      setUser(u ? { email: u.email ?? null, name: (u.user_metadata?.name as string | undefined) ?? null } : null)
    })
    const onDoc = (e: MouseEvent) => { if (open && ref.current && !ref.current.contains(e.target as any)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { mounted = false; sub.subscription?.unsubscribe(); document.removeEventListener('mousedown', onDoc) }
  }, [open, supabase])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const uid = data.user?.id
        if (!uid) { if (mounted) setCartCount(0); return }
        const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('user_id', uid)
        if (mounted) setCartCount(count || 0)
      } catch {}
    }
    load()
    const handler = () => load()
    try { window.addEventListener('cart-changed', handler as any) } catch {}
    const interval = setInterval(load, 15000)
    return () => { mounted = false; clearInterval(interval); try { window.removeEventListener('cart-changed', handler as any) } catch {} }
  }, [supabase])

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/signin" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/90 to-rose-500/80 text-black font-medium shadow-[0_8px_30px_rgba(251,191,36,0.25)] hover:shadow-[0_10px_36px_rgba(251,191,36,0.35)]">
          Sign In
        </Link>
        <Link href="/signup" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-400/60 text-amber-200/90 hover:bg-amber-400/10">
          Sign Up
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/cart" className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 text-sm">
        <ShoppingCart className="w-4 h-4" />
        <span className="hidden sm:inline">Cart</span>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-black text-[11px] font-semibold grid place-items-center">
            {cartCount}
          </span>
        )}
      </Link>
      <div ref={ref} className="relative">
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 hover:bg-white/20 text-sm">
          <User2 className="w-4 h-4" />
          <span className="hidden sm:inline max-w-[160px] truncate">{user?.name || user?.email || 'Account'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur p-2 shadow-xl">
            <div className="text-sm">
              <div className="px-3 py-2 text-white/70">
                <div className="font-medium text-white/90">{user?.name || 'Your account'}</div>
                {user?.email && <div className="text-xs text-white/60">{user.email}</div>}
              </div>
              <div className="h-px bg-white/10 my-1" />
              <Link href="/account" className="block px-3 py-2 rounded-lg hover:bg-white/10 text-white/80">Profile</Link>
              <Link href="/account/orders" className="block px-3 py-2 rounded-lg hover:bg-white/10 text-white/80">Orders</Link>
              <Link href="/account/subscriptions" className="block px-3 py-2 rounded-lg hover:bg-white/10 text-white/80">Subscriptions</Link>
              <Link href="/account/favorites" className="block px-3 py-2 rounded-lg hover:bg-white/10 text-white/80">Favorites</Link>
              <Link href="/account/addresses" className="block px-3 py-2 rounded-lg hover:bg-white/10 text-white/80">Addresses</Link>
              <Link href="/account/settings" className="block px-3 py-2 rounded-lg hover:bg-white/10 text-white/80">Settings</Link>
              <div className="h-px bg-white/10 my-1" />
              <button onClick={async () => { await supabase.auth.signOut(); setOpen(false) }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-white/80">Log out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
