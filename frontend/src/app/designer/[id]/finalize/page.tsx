"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useFlow } from '@/components/flow-provider'

function mapPlacementToPrintful(placement: 'front'|'back'|'left'|'right'): string {
  if (placement === 'left') return 'sleeve_left'
  if (placement === 'right') return 'sleeve_right'
  return placement
}

export default function FinalizePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const productId = Number(params?.id)
  const { color, size, designsByPlacement } = useFlow()

  const selections = useMemo(() => {
    const list: Array<{ placement: 'front'|'back'|'left'|'right'; url: string; transform: { x:number;y:number;w:number;h:number;rotationDeg:number } }> = []
    ;(['front','back','left','right'] as const).forEach((p) => {
      const d = designsByPlacement[p]
      if (d?.url && d.transform) list.push({ placement: p, url: d.url, transform: d.transform })
    })
    return list
  }, [designsByPlacement])

  const [variantId, setVariantId] = useState<number | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)
  const [taskKey, setTaskKey] = useState<string | null>(null)
  const [mockups, setMockups] = useState<Array<{ url: string; placement: string }>>([])

  // Resolve v1 variant id for color/size
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        if (!productId || !color || !size) return
        const res = await fetch(`/api/printful/variants?product_id=${productId}`)
        if (!res.ok) return
        const j = await res.json()
        const list: any[] = j?.result || []
        const match = list.find((v: any) => String(v.size||'')===String(size||'') && String(v.color||'')===String(color||''))
        if (!mounted) return
        setVariantId(match?.variant_id ?? null)
      } catch {}
    })()
    return () => { mounted = false }
  }, [productId, color, size])

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

  return (
    <main className="min-h-[70vh] px-6 py-6 max-w-5xl mx-auto text-white">
      <div className="mb-4">
        <button onClick={() => router.back()} className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.06] text-xs">Back</button>
      </div>

      <h1 className="text-2xl font-semibold mb-3">Finalize design</h1>
      <div className="text-white/70 text-sm mb-4">Selected placements: {selections.length > 0 ? selections.map(s => s.placement).join(', ') : 'None'}</div>

      <button
        onClick={onCreateTask}
        disabled={!variantId || selections.length === 0 || isSubmitting}
        className="rounded-lg px-5 py-3 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-shimmer"
      >{isSubmitting ? 'Submitting…' : 'Create mockups'}</button>

      {taskKey && mockups.length === 0 && (
        <div className="mt-6 text-white/70 text-sm">Generating mockups… this can take ~10 seconds.</div>
      )}

      {mockups.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4">
          {mockups.map((m, idx) => (
            <div key={idx} className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/10">
              <Image src={m.url} alt={m.placement} fill sizes="50vw" className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
