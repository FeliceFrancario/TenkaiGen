"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/browser'

type CartItem = {
  id: string
  product_id: number
  variant_id: number
  color: string | null
  size: string | null
  quantity: number
  files: Array<{ placement: string; image_url: string; position: any }>
  mockups: Array<{ url: string; placement: string }>
}

export default function CartPage() {
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [prices, setPrices] = useState<Record<string, { amount: number; currency: string }>>({})
  const [titles, setTitles] = useState<Record<number, string>>({})
  const [country, setCountry] = useState('US')
  const [stateCode, setStateCode] = useState('')
  const [shippingRates, setShippingRates] = useState<Array<{ name: string; rate: number; currency: string }>>([])
  const [shippingLoading, setShippingLoading] = useState(false)
  const [selectedShippingIdx, setSelectedShippingIdx] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email ?? null))
    return () => { sub.subscription?.unsubscribe() }
  }, [supabase])

  const load = async () => {
    setLoading(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u.user?.id
      if (!uid) { setItems([]); return }
      const { data } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      setItems((data as any) || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalItems = useMemo(() => items.reduce((a, b) => a + (b.quantity || 0), 0), [items])
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const key = `${it.product_id}-${it.variant_id}`
      const p = prices[key]?.amount || 0
      return sum + p * (it.quantity || 1)
    }, 0)
  }, [items, prices])
  const currency = useMemo(() => {
    const first = Object.values(prices)[0]
    return first?.currency || 'USD'
  }, [prices])
  const selectedShipping = useMemo(() => (selectedShippingIdx!=null ? shippingRates[selectedShippingIdx] : null), [selectedShippingIdx, shippingRates])
  const total = useMemo(() => subtotal + (selectedShipping?.rate || 0), [subtotal, selectedShipping])

  const fetchPrices = async (itemsToPrice: CartItem[]) => {
    const out: Record<string, { amount: number; currency: string }> = {}
    await Promise.all(itemsToPrice.map(async (it) => {
      try {
        const r = await fetch(`/api/printful/product?product_id=${it.product_id}`)
        const j = await r.json().catch(() => ({}))
        const result = j?.result || {}
        const v = (result?.variants || []).find((vv: any) => Number(vv.id) === Number(it.variant_id))
        const amount = Number(v?.price || 0)
        if (Number.isFinite(amount) && amount > 0) {
          out[`${it.product_id}-${it.variant_id}`] = { amount, currency: v?.currency || 'USD' }
          return
        }
      } catch {}
      // Fallback minimal price endpoint
      try {
        const r2 = await fetch(`/api/printful/prices?product_id=${it.product_id}`)
        const j2 = await r2.json().catch(() => ({}))
        const res = j2?.result || {}
        const priceObj = res?.price || res
        const amount = Number(priceObj?.amount || 0)
        const cur = priceObj?.currency || 'USD'
        if (Number.isFinite(amount) && amount > 0) {
          out[`${it.product_id}-${it.variant_id}`] = { amount, currency: cur }
        }
      } catch {}
    }))
    setPrices(out)
  }

  useEffect(() => { if (items.length) fetchPrices(items) }, [items])

  const fetchTitles = async (itemsToQuery: CartItem[]) => {
    const distinct = Array.from(new Set(itemsToQuery.map((i) => i.product_id)))
    const map: Record<number, string> = {}
    await Promise.all(distinct.map(async (pid) => {
      try {
        const r = await fetch(`/api/printful/product?product_id=${pid}`)
        const j = await r.json().catch(() => ({}))
        const title = j?.result?.title as string | undefined
        if (title) map[pid] = title
      } catch {}
    }))
    setTitles(map)
  }

  useEffect(() => { if (items.length) fetchTitles(items) }, [items])

  const updateQty = async (id: string, next: number) => {
    if (next < 1) return
    setUpdatingId(id)
    try {
      await supabase.from('cart_items').update({ quantity: next }).eq('id', id)
      await load()
      try { window.dispatchEvent(new CustomEvent('cart-changed')) } catch {}
    } finally {
      setUpdatingId(null)
    }
  }

  const removeItem = async (id: string) => {
    setUpdatingId(id)
    try {
      await supabase.from('cart_items').delete().eq('id', id)
      await load()
      try { window.dispatchEvent(new CustomEvent('cart-changed')) } catch {}
    } finally {
      setUpdatingId(null)
    }
  }

  const estimateShipping = async () => {
    try {
      setShippingLoading(true)
      const payload = {
        country_code: country,
        ...(stateCode ? { state_code: stateCode } : {}),
        items: items.map((it) => ({ variant_id: it.variant_id, quantity: Math.max(1, it.quantity || 1) })),
      }
      const r = await fetch('/api/printful/shipping-rates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await r.json().catch(() => ({}))
      const list: any[] = Array.isArray(j?.result) ? j.result : []
      const normalized = list.map((x: any) => ({ name: x?.name || x?.service || 'Standard', rate: Number(x?.rate || 0), currency: x?.currency || currency }))
      setShippingRates(normalized)
      setSelectedShippingIdx(normalized.length ? 0 : null)
    } finally {
      setShippingLoading(false)
    }
  }

  return (
    <main className="min-h-[70vh] px-6 py-8 max-w-5xl mx-auto text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Your cart</h1>
        <Link href="/catalog" className="text-white/70 hover:text-white text-sm">Continue shopping</Link>
      </div>
      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 animate-pulse">Loading…</div>
      ) : !email ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
          <div className="text-white/80 mb-3">Please sign in to view your cart.</div>
          <div className="flex gap-3">
            <Link href="/signin?returnUrl=/cart" className="px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition text-sm">Sign In</Link>
            <Link href="/signup?returnUrl=/cart" className="px-4 py-2 rounded-full bg-white text-black hover:opacity-90 transition text-sm">Sign Up</Link>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">Your cart is empty.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {items.map((it) => {
            const thumb = it.mockups?.[0]?.url || ''
              const key = `${it.product_id}-${it.variant_id}`
              const price = prices[key]?.amount
              return (
              <div key={it.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex gap-4 items-center">
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10 bg-white/[0.06]">
                  {thumb ? (
                    <Image src={thumb} alt="item" fill sizes="96px" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-white/50 text-xs">No image</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-white/90">{titles[it.product_id] || `Product #${it.product_id}`}</div>
                  <div className="text-xs text-white/60">Variant #{it.variant_id} · {it.color || '-'} · {it.size || '-'}</div>
                  {typeof price === 'number' && (
                    <div className="text-sm text-white/80 mt-1">Price: {price.toFixed(2)} {currency}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(it.id, (it.quantity || 1) - 1)} disabled={updatingId===it.id || (it.quantity||1) <= 1} className="px-2 py-1 rounded-md border border-white/10 text-white/80">-</button>
                  <span className="min-w-[2ch] text-center text-white/90">{it.quantity}</span>
                  <button onClick={() => updateQty(it.id, (it.quantity || 1) + 1)} disabled={updatingId===it.id} className="px-2 py-1 rounded-md border border-white/10 text-white/80">+</button>
                </div>
                <button onClick={() => removeItem(it.id)} disabled={updatingId===it.id} className="ml-3 px-3 py-1.5 rounded-md border border-white/10 text-white/70 text-xs">Remove</button>
              </div>
              )
            })}
          </div>
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Items</span>
                  <span className="text-white/90">{totalItems}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-white/70">Subtotal</span>
                  <span className="text-white/90">{subtotal.toFixed(2)} {currency}</span>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <div className="text-sm text-white/80 mb-2">Shipping estimate</div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="Country code (e.g., US)" className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm" />
                  <input value={stateCode} onChange={(e) => setStateCode(e.target.value.toUpperCase())} placeholder="State (if required)" className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm" />
                </div>
                <button onClick={estimateShipping} disabled={shippingLoading} className="mt-2 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm">{shippingLoading ? 'Estimating…' : 'Estimate shipping'}</button>
                {shippingRates.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {shippingRates.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedShippingIdx(i)}
                        className={`w-full flex items-center justify-between text-sm rounded-md px-3 py-2 border ${selectedShippingIdx===i ? 'border-amber-400/50 bg-white/[0.08] text-white' : 'border-white/10 bg-white/[0.04] text-white/80 hover:border-white/20'}`}
                      >
                        <span>{r.name}</span>
                        <span>{r.rate.toFixed(2)} {r.currency}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t border-white/10 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Total</span>
                  <span className="text-white/90">{total.toFixed(2)} {currency}</span>
                </div>
                <button className="w-full rounded-lg px-5 py-3 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-semibold inline-flex items-center justify-center gap-2">Checkout (soon)</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}


