"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useFlow } from '@/components/flow-provider'
import { STYLES } from '@/lib/styles'
import { Sparkles, Upload, Type as TypeIcon, ArrowLeft } from 'lucide-react'

// Removed Printful logo constant

type DesignerPageProps = {
  productId: number
  product: any
  initialSearch?: Record<string, string>
}

type TemplatePlacement = {
  placement: string
  width: number
  height: number
  x: number
  y: number
  view_image?: string | null
}

export default function DesignerPage({ productId, product, initialSearch }: DesignerPageProps) {
  const params = useSearchParams()
  const fromParams = (k: string) => initialSearch?.[k] || params.get(k) || undefined
  const router = useRouter()
  const colorHexParam = fromParams('color_hex')

  const [placement, setPlacement] = useState<string>(String(fromParams('placement') || 'front'))
  const [color] = useState<string | undefined>(fromParams('color'))
  const [size] = useState<string | undefined>(fromParams('size'))

  const { isGenerating, setGenerating, setStyle: setFlowStyle, setPrompt: setFlowPrompt, setPrintArea, setDesignUrl: setFlowDesignUrl, setDesignTransform } = useFlow()

  // Mockup templates (print areas)
  const [templates, setTemplates] = useState<TemplatePlacement[]>([])
  const [activeMockup, setActiveMockup] = useState<string | null>(null)

  // Real garment images for placements/colors
  type PlImage = { placement: string; image_url: string; color_name?: string | null; background_color?: string | null }
  const [images, setImages] = useState<PlImage[]>([])
  const [canvasBg, setCanvasBg] = useState<string | null>(null)

  // Design state (single image for now)
  const [designUrl, setDesignUrl] = useState<string>('')
  const [designRect, setDesignRect] = useState<{ x: number; y: number; w: number; h: number; r: number }>({ x: 0, y: 0, w: 0, h: 0, r: 0 })
  const [activeTab, setActiveTab] = useState<'ai' | 'uploads' | 'text'>('ai')
  const [selectedStyle, setSelectedStyle] = useState<string | undefined>(undefined)
  const [prompt, setPrompt] = useState<string>('')
  const [isMoving, setIsMoving] = useState<boolean>(false)
  const [designs, setDesigns] = useState<string[]>([])

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const designRef = useRef<HTMLDivElement | null>(null)

  // Fallback print area if mockup-templates are unavailable
  const getTemplate = (place: string): TemplatePlacement | undefined => {
    const found = templates.find((t) => t.placement === place)
    if (found && found.width > 0 && found.height > 0) return found
    const cw = canvasRef.current?.clientWidth || 900
    const p = (place || 'front').toLowerCase()
    if (p.includes('left') || p.includes('right')) {
      // Sleeves: narrow, tall area toward sides
      const areaW = Math.round(cw * 0.18)
      const areaH = Math.round(cw * 0.45)
      const y = Math.round(cw * 0.24)
      const x = p.includes('left')
        ? Math.round(cw * 0.18)
        : Math.round(cw - areaW - cw * 0.18)
      return { placement: place, width: areaW, height: areaH, x, y, view_image: null }
    }
    // Front/back: centered, smaller than before
    const areaW = Math.round(cw * 0.42)
    const areaH = Math.round(cw * 0.52)
    const x = Math.round((cw - areaW) / 2)
    const y = Math.round(cw * 0.20)
    return { placement: place, width: areaW, height: areaH, x, y, view_image: null }
  }

  const refreshDesigns = async () => {
    try {
      const res = await fetch('/api/designs/list')
      if (!res.ok) return
      const j = await res.json()
      const arr: string[] = Array.isArray(j?.result) ? j.result : []
      setDesigns(arr)
    } catch {}
  }

  // Load mockup templates for the product
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/printful/mockup-templates?product_id=${productId}`)
        if (!res.ok) return
        const json = await res.json()
        const items = (json?.result || []) as any[]
        const tpls: TemplatePlacement[] = []
        for (const item of items) {
          const p = String(item?.placement || item?.view || '').toLowerCase()
          const allowed = ['front','back','left','right']
          if (!allowed.includes(p)) continue
          tpls.push({
            placement: p,
            width: Number(item?.print_area?.width || item?.width || 0),
            height: Number(item?.print_area?.height || item?.height || 0),
            x: Number(item?.print_area?.x || item?.x || 0),
            y: Number(item?.print_area?.y || item?.y || 0),
            view_image: item?.image_url || item?.view_image || null,
          })
        }
        if (!mounted) return
        setTemplates(tpls)
        const first = tpls.find((t) => t.placement === placement) || tpls[0]
        if (first) setPlacement(first.placement)
        // keep activeMockup from real images once fetched
      } catch {}
    })()
    return () => { mounted = false }
  }, [productId])

  // Prefetch product route for smoother back
  useEffect(() => {
    try { router.prefetch(`/catalog/product/${productId}`) } catch {}
  }, [router, productId])

  // Load real garment images
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch(`/api/printful/images?product_id=${productId}&blank=1`)
        if (!res.ok) return
        const j = await res.json()
        const arr: PlImage[] = (j?.result || [])
          .filter((i: any) => {
            const p = String(i.placement || '').toLowerCase()
            const u = String(i.image_url || '').toLowerCase()
            if (/label/.test(p) || /embroid/.test(p)) return false
            if (u.includes('/label') || u.includes('embroidery')) return false
            return true
          })
        if (!mounted) return
        setImages(arr)
      } catch {}
    })()
    return () => { mounted = false }
  }, [productId])

  // Load user B2 designs list (S3-compatible)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/designs/list')
        if (!res.ok) return
        const j = await res.json()
        const arr: string[] = Array.isArray(j?.result) ? j.result : []
        if (!mounted) return
        setDesigns(arr)
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  // Fit the design inside the print area by default
  useEffect(() => {
    const tpl = getTemplate(placement)
    if (!tpl) return
    // Assume canvas is 800px max area; scale proportionally
    const maxW = 800
    const scale = 1
    const areaW = tpl.width * scale
    const areaH = tpl.height * scale
    const x = tpl.x * scale
    const y = tpl.y * scale
    const pad = 4
    const w = Math.max(40, areaW - pad * 2)
    const h = Math.max(40, areaH - pad * 2)
    setDesignRect({ x: x + pad, y: y + pad, w, h, r: 0 })
  }, [templates, placement])

  // Sync selected design URL to global flow
  useEffect(() => {
    setFlowDesignUrl(designUrl || undefined)
  }, [designUrl, setFlowDesignUrl])

  // Sync normalized transform (0..1) relative to print area
  useEffect(() => {
    const tpl = getTemplate(placement)
    if (!tpl || !designUrl) { setDesignTransform(undefined); return }
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
    const nx = clamp01((designRect.x - tpl.x) / (tpl.width || 1))
    const ny = clamp01((designRect.y - tpl.y) / (tpl.height || 1))
    const nw = clamp01(designRect.w / (tpl.width || 1))
    const nh = clamp01(designRect.h / (tpl.height || 1))
    const rot = ((designRect.r % 360) + 360) % 360
    const p: 'front' | 'back' | 'left' | 'right' = (placement as any)
    setDesignTransform({ placement: p, x: nx, y: ny, w: nw, h: nh, rotationDeg: rot })
  }, [designRect, placement, designUrl, setDesignTransform])

  // Tokenized color matching (denim/indigo/heather etc.)
  const normalizeColor = (s?: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const colorTokens = (s?: string | null) => normalizeColor(s).split(' ').filter(Boolean)
  const colorMatches = (a?: string | null, b?: string | null) => {
    const A = new Set(colorTokens(a)); const B = new Set(colorTokens(b))
    if (!A.size || !B.size) return false
    // direct token intersection
    let tokenIntersect = false
    A.forEach((t) => { if (B.has(t)) tokenIntersect = true })
    if (tokenIntersect) return true
    // denim/indigo handling
    const map: Record<string, string[]> = { denim: ['indigo','navy'], indigo: ['denim','navy'] }
    let cross = false
    A.forEach((t) => {
      const ex = (map as any)[t] as string[] | undefined
      if (ex) ex.forEach((e) => { if (B.has(e)) cross = true })
    })
    if (cross) return true
    return false
  }

  // Update mockup image according to placement and color
  useEffect(() => {
    const p = String(placement)
    // Prefer image matching selected color, otherwise any for the placement
    const candidates = images.filter((i) => String(i.placement || '').toLowerCase().includes(p))
    const byColor = candidates.find((i) => colorMatches(i.color_name, color))
    const pick = byColor || candidates[0]
    if (pick?.image_url) setActiveMockup(pick.image_url)
    setCanvasBg(((pick?.background_color as string) || colorHexParam || null))
  }, [images, placement, color, colorHexParam])

  // Sync print area to flow
  useEffect(() => {
    const key = (placement || '').toLowerCase()
    const mapped = key.includes('back') ? 'Back' : 'Front'
    setPrintArea(mapped as any)
  }, [placement, setPrintArea])

  // Drag/scale/rotate handlers (simple)
  const onDrag: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!designRef.current || !canvasRef.current) return
    const startX = e.clientX
    const startY = e.clientY
    const start = { ...designRect }
    setIsMoving(true)
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      setDesignRect((r) => {
        const tpl = getTemplate(placement)
        if (!tpl) return { ...r, x: start.x + dx, y: start.y + dy }
        const nx = start.x + dx
        const ny = start.y + dy
        const minX = tpl.x + 2
        const minY = tpl.y + 2
        const maxX = tpl.x + tpl.width - r.w - 2
        const maxY = tpl.y + tpl.height - r.h - 2
        return { ...r, x: Math.min(Math.max(nx, minX), Math.max(minX, maxX)), y: Math.min(Math.max(ny, minY), Math.max(minY, maxY)) }
      })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setIsMoving(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.05 : 0.95
    setDesignRect((r) => {
      const nw = Math.max(24, r.w * factor)
      const nh = Math.max(24, r.h * factor)
      const tpl = getTemplate(placement)
      if (!tpl) return { ...r, w: nw, h: nh }
      // clamp if outside area after resize
      const maxW = tpl.width - 4
      const maxH = tpl.height - 4
      const clampedW = Math.min(nw, maxW)
      const clampedH = Math.min(nh, maxH)
      const maxX = tpl.x + tpl.width - clampedW - 2
      const maxY = tpl.y + tpl.height - clampedH - 2
      return {
        ...r,
        w: clampedW,
        h: clampedH,
        x: Math.min(Math.max(r.x, tpl.x + 2), Math.max(tpl.x + 2, maxX)),
        y: Math.min(Math.max(r.y, tpl.y + 2), Math.max(tpl.y + 2, maxY)),
      }
    })
  }

  const onRotateClick = () => {
    setDesignRect((r) => ({ ...r, r: (r.r + 15) % 360 }))
  }

  const onFitArea = () => {
    const tpl = getTemplate(placement)
    if (!tpl) return
    const pad = 8
    const w = Math.max(40, tpl.width - pad * 2)
    const h = Math.max(40, tpl.height - pad * 2)
    setDesignRect({ x: tpl.x + pad, y: tpl.y + pad, w, h, r: 0 })
  }

  const placementsAvail = useMemo(() => {
    const ps = new Set<string>()
    for (const t of templates) ps.add(t.placement)
    for (const i of images) {
      const p = String(i.placement || '').toLowerCase()
      if (p.includes('label') || p.includes('embroid')) continue
      if (p.includes('front')) ps.add('front')
      else if (p.includes('back')) ps.add('back')
      else if (p.includes('left')) ps.add('left')
      else if (p.includes('right')) ps.add('right')
    }
    return ['front','back','left','right'].filter((p) => ps.has(p))
  }, [templates, images])

  // Generate flow (AI tab)
  const handleGenerate = async () => {
    const rawPrompt = prompt.trim()
    if (!rawPrompt) return
    try {
      setGenerating(true)
      setFlowStyle(selectedStyle || 'Standard')
      setFlowPrompt(rawPrompt)
      // parse
      await fetch('/api/parse-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: rawPrompt, style: selectedStyle || undefined }),
      }).catch(() => null)
      // generate
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSlug: null,
          productName: product?.title || '',
          variant: size || null,
          style: selectedStyle || 'Standard',
          color: color || null,
          size: size || null,
          printArea: placement.includes('back') ? 'Back' : 'Front',
          prompt: rawPrompt,
        }),
      }).catch(() => null)
      // refresh designs list to include newly generated items
      await refreshDesigns()
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main className="min-h-[70vh] px-6 py-6 max-w-7xl mx-auto text-white">
      <div className="mb-3">
        <button
          onClick={() => {
            // Use replace to avoid back button issues
            router.replace(`/catalog/product/${productId}`)
          }}
          className="inline-flex items-center gap-2 text-white/80 hover:text-white"
        >
          <span className="inline-flex w-8 h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]"><ArrowLeft className="w-4 h-4" /></span>
          <span className="text-sm">Back to product</span>
        </button>
      </div>
      <div className="grid grid-cols-[56px_320px_1fr] gap-4">
        {/* Vertical icon sidebar */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 flex flex-col items-center gap-2">
          <button title="AI" onClick={() => setActiveTab('ai')} className={`w-10 h-10 flex items-center justify-center rounded-lg border ${activeTab==='ai' ? 'border-amber-400/40 bg-white/[0.10]' : 'border-white/10 hover:border-white/20 bg-white/[0.05]'}`}>
            <Sparkles className="w-5 h-5" />
          </button>
          <button title="Uploads" onClick={() => setActiveTab('uploads')} className={`w-10 h-10 flex items-center justify-center rounded-lg border ${activeTab==='uploads' ? 'border-amber-400/40 bg-white/[0.10]' : 'border-white/10 hover:border-white/20 bg-white/[0.05]'}`}>
            <Upload className="w-5 h-5" />
          </button>
          <button title="Text" onClick={() => setActiveTab('text')} className={`w-10 h-10 flex items-center justify-center rounded-lg border ${activeTab==='text' ? 'border-amber-400/40 bg-white/[0.10]' : 'border-white/10 hover:border-white/20 bg-white/[0.05]'}`}>
            <TypeIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Left content panel per tab */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {activeTab === 'ai' && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-sm text-white/60 mb-2">Style</div>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => (
                    <button key={s} onClick={() => setSelectedStyle(s)} className={`px-3 py-1.5 rounded-lg border text-sm ${selectedStyle===s ? 'border-amber-400/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.04]'}`}>{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-white/60 mb-2">Prompt</div>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your design..." rows={8} className="w-full resize-none bg-transparent outline-none placeholder:text-white/40 text-white" />
              </div>
              <button onClick={handleGenerate} disabled={!prompt.trim()} className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-shimmer">
                {isGenerating ? 'Generating…' : 'Generate'}
              </button>
              {/* Available designs from B2 */}
              {designs.length > 0 && (
                <div>
                  <div className="text-sm text-white/60 mb-2">Your designs</div>
                  <div className="grid grid-cols-3 gap-2">
                    {designs.map((u) => (
                      <button key={u} onClick={() => { setDesignUrl(u); onFitArea() }} className="relative aspect-square rounded-md overflow-hidden border border-white/10 hover:border-amber-400/40">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="design" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'uploads' && (
            <div className="flex flex-col gap-3">
              <div className="text-sm text-white/60">Upload an image</div>
              <input type="file" accept="image/*" className="text-white/80 text-sm" onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  const url = URL.createObjectURL(f)
                  setDesignUrl(url)
                  setDesigns((prev) => (prev.includes(url) ? prev : [url, ...prev]))
                }
              }} />
            </div>
          )}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-3">
              <div className="text-sm text-white/60">Add text</div>
              <input type="text" placeholder="Your text here" className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm" />
              <div className="text-xs text-white/50">Font selection coming next.</div>
            </div>
          )}
        </div>

        {/* Right canvas */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {placementsAvail.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlacement(p)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${placement===p ? 'border-amber-400/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.04]'}`}
                >{p.charAt(0).toUpperCase()+p.slice(1).replace('_',' ')}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onRotateClick} className="px-2 py-1.5 rounded-md border border-white/10 bg-white/[0.06] text-xs">Rotate 15°</button>
              <button onClick={onFitArea} className="px-2 py-1.5 rounded-md border border-white/10 bg-white/[0.06] text-xs">Fit to area</button>
            </div>
          </div>

          <div className="mt-3 relative overflow-auto">
            <div ref={canvasRef} className="relative mx-auto max-w-[900px]" style={{ backgroundColor: canvasBg || undefined }}>
              {activeMockup ? (
                <Image src={activeMockup} alt="mockup" width={900} height={900} className="w-full h-auto object-contain opacity-90 saturate-[0.85]" />
              ) : (
                <div className="w-full h-[480px] bg-white/[0.04] border border-white/10 rounded-xl animate-pulse flex items-center justify-center">
                  <div className="text-white/40 text-sm">Loading mockup...</div>
                </div>
              )}
              {/* Print area dashed overlay */}
              {(() => { const tpl = getTemplate(placement); return tpl ? (
                <div style={{ position:'absolute', left: tpl.x, top: tpl.y, width: tpl.width, height: tpl.height }} className={`pointer-events-none ${isMoving ? 'border-2 border-dashed border-amber-300/70' : 'border border-dashed border-white/40'}`} />
              ) : null })()}
              {/* Optional: visualize print area as invisible bounds; keep it subtle */}
              {/* Design rect *inside* the canvas */}
              <div
                ref={designRef}
                onMouseDown={onDrag}
                onWheel={onWheel}
                style={{ position: 'absolute', left: designRect.x, top: designRect.y, width: designRect.w, height: designRect.h, transform: `rotate(${designRect.r}deg)` }}
                className="group border-2 border-amber-400/60 rounded-md shadow-[0_10px_30px_rgba(212,175,55,0.25)] cursor-move"
              >
                {designUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={designUrl} alt="design" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-xs text-white/50">Pick a design</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
