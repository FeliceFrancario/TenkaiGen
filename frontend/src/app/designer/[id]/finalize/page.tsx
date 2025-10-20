"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useFlow } from '@/components/flow-provider'
import { createClient } from '@/lib/supabase/browser'
import BackHomeBar from '@/components/back-home-bar'

function mapPlacementToPrintful(placement: 'front'|'back'|'left'|'right'): string {
  if (placement === 'left') return 'sleeve_left'
  if (placement === 'right') return 'sleeve_right'
  return placement
}

type Draft = {
  id?: string
  product_id: number
  color: string | null
  size: string | null
  designs_by_placement: Partial<Record<'front'|'back'|'left'|'right', { url: string; transform?: { x:number;y:number;w:number;h:number;rotationDeg:number } }>>
  prompt?: string | null
  style?: string | null
  ts?: number
} | null

export default function FinalizePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const productId = Number(params?.id)
  const { color, size, designsByPlacement } = useFlow()
  const supabase = createClient()

  const [draft, setDraft] = useState<Draft>(null)

  // Restore from sessionStorage draft
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.sessionStorage.getItem('designDraft')
      if (!raw) return
      const d = JSON.parse(raw) as Draft
      if (d && Number(d.product_id) === Number(productId)) setDraft(d)
    } catch {}
  }, [productId])

  // We no longer load drafts from database. Session-only.

  const colorEff = color || draft?.color || null
  const sizeEff = size || draft?.size || null

  const selections = useMemo(() => {
    const src = (Object.keys(designsByPlacement || {}).length > 0 ? designsByPlacement : (draft?.designs_by_placement || {})) as NonNullable<Draft>['designs_by_placement']
    const list: Array<{ placement: 'front'|'back'|'left'|'right'; url: string; transform: { x:number;y:number;w:number;h:number;rotationDeg:number } }> = []
    ;(['front','back','left','right'] as const).forEach((p) => {
      const d = src?.[p]
      if (d?.url && d.transform) list.push({ placement: p, url: d.url, transform: d.transform })
    })
    return list
  }, [designsByPlacement, draft])

  const [variantId, setVariantId] = useState<number | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [taskKey, setTaskKey] = useState<string | null>(null)
  const [mockups, setMockups] = useState<Array<{ url: string; placement: string }>>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [email, setEmail] = useState<string | null>(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email ?? null))
    return () => { sub.subscription?.unsubscribe() }
  }, [supabase])

  // Resolve v1 variant id for color/size (with fallbacks)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!productId || !colorEff || !sizeEff) return
        const res = await fetch(`/api/printful/variants?product_id=${productId}`)
        if (!res.ok) return
        const j = await res.json()
        const list: any[] = j?.result || []
        const match = list.find((v: any) => String(v.size||'')===String(sizeEff||'') && String(v.color||'')===String(colorEff||''))
        if (!mounted) return
        setVariantId(match?.variant_id ?? null)
      } catch {}
    })()
    return () => { mounted = false }
  }, [productId, colorEff, sizeEff])

  // Create mockup task
  const onCreateTask = async () => {
    if (!productId || !variantId || selections.length === 0) return
    setSubmitting(true)
    try {
      // Fetch printfiles to get area_width/area_height per placement
      const pf = await fetch(`/api/printful/printfiles?product_id=${productId}`)
      if (!pf.ok) throw new Error('Failed to fetch printfiles')
      const pfj = await pf.json()
      const result = pfj?.result || {}
      const printfiles: any[] = Array.isArray(result?.printfiles) ? result.printfiles : []
      const variantPrintfiles: any[] = Array.isArray(result?.variant_printfiles) ? result.variant_printfiles : []

      const findArea = (placement: 'front'|'back'|'left'|'right') => {
        const pfPlacement = mapPlacementToPrintful(placement)
        const vm = variantPrintfiles.find((v: any) => Number(v?.variant_id) === Number(variantId))
        const pfId = vm?.placements?.[pfPlacement]
        if (!pfId) return { area_width: 1000, area_height: 1000 }
        const rec = printfiles.find((p: any) => Number(p?.printfile_id) === Number(pfId))
        const area_width = Number(rec?.width || 1000)
        const area_height = Number(rec?.height || 1000)
        return { area_width, area_height }
      }

      const files = selections.map((s) => {
        const { area_width, area_height } = findArea(s.placement)
        return {
          placement: mapPlacementToPrintful(s.placement),
          image_url: s.url,
          position: {
            area_width,
            area_height,
            width: Math.round(s.transform.w * area_width),
            height: Math.round(s.transform.h * area_height),
            top: Math.round(s.transform.y * area_height),
            left: Math.round(s.transform.x * area_width),
          },
        }
      })

      const body = {
        product_id: productId,
        variant_ids: [variantId],
        format: 'png',
        width: 1000,
        files,
      }
      const ct = await fetch('/api/printful/mockup/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!ct.ok) throw new Error('Failed to create task')
      const j = await ct.json()
      const key = String(j?.result?.task_key || '')
      if (key) setTaskKey(key)
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-start generation when ready
  useEffect(() => {
    if (!taskKey && !isSubmitting && variantId && selections.length > 0) {
      onCreateTask()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantId, selections.length])

  // Poll task
  useEffect(() => {
    if (!taskKey) return
    let mounted = true
    let t: any
    const poll = async () => {
      try {
        const r = await fetch(`/api/printful/mockup/task?task_key=${encodeURIComponent(taskKey)}`)
        if (!r.ok) return
        const j = await r.json()
        const status = String(j?.result?.status || '')
        if (status === 'completed') {
          const arr: any[] = Array.isArray(j?.result?.mockups) ? j.result.mockups : []
          const flat: Array<{ url: string; placement: string }> = []
          for (const m of arr) {
            const p = String(m?.placement || '')
            const url = String(m?.mockup_url || '')
            if (url) flat.push({ url, placement: p })
          }
          if (mounted) setMockups(flat)
          return
        }
      } catch {}
      t = setTimeout(poll, 1500)
    }
    poll()
    return () => { mounted = false; if (t) clearTimeout(t) }
  }, [taskKey])

  const primaryMockup = mockups[selectedIdx]?.url || ''

  const onAddToCart = async () => {
    if (!email) { setShowAuthPrompt(true); return }
    if (!variantId || selections.length === 0) return
    setSaving(true)
    try {
      // Persist selection for later order creation
      const pf = await fetch(`/api/printful/printfiles?product_id=${productId}`)
      const pfj = await pf.json().catch(() => ({}))
      const result = pfj?.result || {}
      const printfiles: any[] = Array.isArray(result?.printfiles) ? result.printfiles : []
      const variantPrintfiles: any[] = Array.isArray(result?.variant_printfiles) ? result.variant_printfiles : []
      const findArea = (placement: 'front'|'back'|'left'|'right') => {
        const pfPlacement = mapPlacementToPrintful(placement)
        const vm = variantPrintfiles.find((v: any) => Number(v?.variant_id) === Number(variantId))
        const pfId = vm?.placements?.[pfPlacement]
        if (!pfId) return { area_width: 1000, area_height: 1000 }
        const rec = printfiles.find((p: any) => Number(p?.printfile_id) === Number(pfId))
        const area_width = Number(rec?.width || 1000)
        const area_height = Number(rec?.height || 1000)
        return { area_width, area_height }
      }
      const files = selections.map((s) => {
        const { area_width, area_height } = findArea(s.placement)
        return {
          placement: mapPlacementToPrintful(s.placement),
          image_url: s.url,
          position: {
            area_width,
            area_height,
            width: Math.round(s.transform.w * area_width),
            height: Math.round(s.transform.h * area_height),
            top: Math.round(s.transform.y * area_height),
            left: Math.round(s.transform.x * area_width),
          },
        }
      })
      const { data: u } = await supabase.auth.getUser()
      const userId = u.user?.id
      
      // Look up database product by Printful ID
      console.log('[Add to Cart] Looking up product with printful_id:', productId)
      const { data: dbProduct, error: productError } = await supabase
        .from('products')
        .select('id, name, printful_id')
        .eq('printful_id', productId)
        .single()
      
      if (productError || !dbProduct) {
        console.error('[Add to Cart] Product lookup failed. Printful ID:', productId, 'Error:', productError)
        throw new Error(`Product #${productId} not found in database. Please sync products first.`)
      }
      
      console.log('[Add to Cart] Found product:', dbProduct.name, 'DB ID:', dbProduct.id)
      
      // Look up database variant by Printful variant ID
      console.log('[Add to Cart] Looking up variant with printful_variant_id:', variantId, 'for product:', dbProduct.id)
      const { data: dbVariant, error: variantError } = await supabase
        .from('variants')
        .select('id, printful_variant_id, size, color')
        .eq('printful_variant_id', variantId)
        .eq('product_id', dbProduct.id)
        .single()
      
      if (variantError || !dbVariant) {
        console.error('[Add to Cart] Variant lookup failed. Printful variant ID:', variantId, 'Product DB ID:', dbProduct.id, 'Error:', variantError)
        
        // Show available variants for debugging
        const { data: availableVariants } = await supabase
          .from('variants')
          .select('printful_variant_id, size, color')
          .eq('product_id', dbProduct.id)
          .limit(5)
        console.log('[Add to Cart] Available variants for this product:', availableVariants)
        
        throw new Error(`Variant #${variantId} not found for product "${dbProduct.name}". Available variants: ${availableVariants?.map(v => `${v.size}-${v.color} (ID: ${v.printful_variant_id})`).join(', ')}`)
      }
      
      console.log('[Add to Cart] Found variant:', dbVariant.size, dbVariant.color, 'DB ID:', dbVariant.id)
      
      // Insert to cart with database references
      const { error: insertError } = await supabase.from('cart_items').insert({
        user_id: userId,
        product_id: dbProduct.id, // Database product UUID
        variant_id: dbVariant.id, // Database variant UUID
        printful_product_id: productId, // Printful product ID (for reference)
        printful_variant_id: variantId, // Printful variant ID (for ordering)
        color: colorEff,
        size: sizeEff,
        quantity: 1,
        files, // AI-generated design files with positions
        mockups, // Generated mockup previews
        prompt: draft?.prompt ?? null,
        style: draft?.style ?? null,
      })
      
      if (insertError) {
        console.error('Cart insert error:', insertError)
        throw new Error('Failed to add to cart: ' + insertError.message)
      }
      
      router.push('/cart')
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname + window.location.search : ''

  return (
    <main className="min-h-[70vh] px-6 py-8 max-w-6xl mx-auto text-white">
      <BackHomeBar />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        {/* Left: Mockup preview */}
        <div>
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03]">
            {primaryMockup ? (
              <Image src={primaryMockup} alt="Preview" fill sizes="50vw" className="object-contain" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">
                {taskKey ? 'Generating mockups…' : 'Preparing mockup generation…'}
              </div>
            )}
          </div>
          {mockups.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {mockups.map((m, i) => (
                <button key={`${m.url}|${i}`} onClick={() => setSelectedIdx(i)} className={`relative w-full aspect-square rounded-lg overflow-hidden border ${selectedIdx===i ? 'border-amber-400/60' : 'border-white/10 hover:border-white/20'}`}>
                  <Image src={m.url} alt={m.placement} fill sizes="20vw" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recap + CTA */}
        <div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-semibold mb-4">Your selection</h2>
            <div className="space-y-2 text-sm text-white/80">
              <div className="flex justify-between"><span>Product</span><span>#{productId}</span></div>
              <div className="flex justify-between"><span>Color</span><span>{colorEff || '-'}</span></div>
              <div className="flex justify-between"><span>Size</span><span>{sizeEff || '-'}</span></div>
              <div className="flex justify-between"><span>Placements</span><span>{selections.length > 0 ? selections.map(s=>s.placement).join(', ') : '-'}</span></div>
            </div>
            <button
              onClick={onAddToCart}
              disabled={saving || mockups.length === 0}
              className="mt-5 w-full rounded-lg px-5 py-3 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M7 4h-2l-1 2h-2v2h2l3.6 7.59-1.35 2.44c-.16.28-.25.61-.25.97 0 1.1.9 2 2 2h12v-2h-12l1.1-2h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1h-14.31l-.94-2zm3 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm8 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
              {saving ? 'Adding…' : 'Add to cart'}
            </button>
          </div>
        </div>
      </div>

      {/* Auth prompt modal */}
      {showAuthPrompt && !email && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <div className="text-white/90 font-medium mb-1">Sign in to continue</div>
            <div className="text-white/60 text-sm mb-4">You need to login to save your design and create the order.</div>
            <div className="flex gap-3">
              <a href={`/signin?returnUrl=${encodeURIComponent(currentPath)}`} className="px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition text-sm">Sign In</a>
              <a href={`/signup?returnUrl=${encodeURIComponent(currentPath)}`} className="px-4 py-2 rounded-full bg-white text-black hover:opacity-90 transition text-sm">Sign Up</a>
              <button onClick={() => setShowAuthPrompt(false)} className="ml-auto px-3 py-1.5 rounded-md border border-white/10 text-white/70 text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
