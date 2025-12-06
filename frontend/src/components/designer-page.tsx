"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useFlow } from '@/components/flow-provider'
import { STYLES } from '@/lib/styles'
import { Sparkles, Upload, Type as TypeIcon, ArrowLeft, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

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

  const { isGenerating, setGenerating, setStyle: setFlowStyle, setPrompt: setFlowPrompt, setPrintArea, setDesignUrl: setFlowDesignUrl, setDesignTransform, designsByPlacement, setDesignForPlacement, latestGeneratedUrls } = useFlow()

  // Auth state for gating confirm
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUserEmail(data.user?.email ?? null)
    })()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserEmail(session?.user?.email ?? null))
    return () => { sub.subscription?.unsubscribe() }
  }, [supabase])

  // Mockup templates (print areas) - legacy (catalog blank-images); kept as fallback imagery
  const [templates, setTemplates] = useState<TemplatePlacement[]>([])
  const [activeMockup, setActiveMockup] = useState<string | null>(null)

  // Real garment images for placements/colors
  type PlImage = { placement: string; image_url: string; color_name?: string | null; background_color?: string | null }
  const [images, setImages] = useState<PlImage[]>([])
  const [canvasBg, setCanvasBg] = useState<string | null>(null)

  // Layout template (Printful Mockup Generator templates)
  const [variantId, setVariantId] = useState<number | null>(null)
  const [layoutTemplate, setLayoutTemplate] = useState<{
    placement: string
    templateW: number
    templateH: number
    areaX: number
    areaY: number
    areaW: number
    areaH: number
    imageUrl?: string | null
    backgroundUrl?: string | null
    backgroundColor?: string | null
  } | null>(null)
  const [availablePlacements, setAvailablePlacements] = useState<string[]>([])

  // Design state (single image for now)
  const [designUrl, setDesignUrl] = useState<string>('')
  const [designDims, setDesignDims] = useState<{ w: number; h: number } | null>(null)
  const [designRect, setDesignRect] = useState<{ x: number; y: number; w: number; h: number; r: number }>({ x: 0, y: 0, w: 0, h: 0, r: 0 })
  const [activeTab, setActiveTab] = useState<'ai' | 'uploads' | 'text'>('ai')
  const [selectedStyle, setSelectedStyle] = useState<string | undefined>(undefined)
  const [prompt, setPrompt] = useState<string>('')
  const [isMoving, setIsMoving] = useState<boolean>(false)
  const [designs, setDesigns] = useState<string[]>([])
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editPrompt, setEditPrompt] = useState<string>('')
  const [editError, setEditError] = useState<string | null>(null)
  const [isSubmittingEdit, setSubmittingEdit] = useState(false)

  // Background removal modal state
  const [showBgPrompt, setShowBgPrompt] = useState(false)
  const [bgTargetUrl, setBgTargetUrl] = useState<string | null>(null)
  const [bgTolerance, setBgTolerance] = useState<number>(245)
  const [bgIsProcessing, setBgIsProcessing] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [bgResultUrl, setBgResultUrl] = useState<string | null>(null)

  const openAddToProduct = (url: string) => {
    setBgTargetUrl(url)
    setBgTolerance(245)
    setBgError(null)
    setBgIsProcessing(false)
    setBgResultUrl(null)
    setShowBgPrompt(true)
  }
  const confirmKeepBackground = () => {
    if (!bgTargetUrl) return
    setDesignUrl(bgTargetUrl)
    onFitArea()
    setShowBgPrompt(false)
  }
  const confirmRemoveBackground = async () => {
    if (!bgTargetUrl) return
    try {
      setBgIsProcessing(true)
      setBgError(null)
      const res = await fetch('/api/images/remove-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: bgTargetUrl, threshold: bgTolerance }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(t || 'Failed to remove background')
      }
      const j = await res.json()
      const baseUrl = j?.url || null
      const signedUrl = j?.signedUrl || null
      // Do NOT mutate signed URLs; add cache-buster only to unsigned
      const previewUrl = signedUrl || (baseUrl ? `${baseUrl}?t=${Date.now()}` : null)
      console.log('[remove-bg] result', { baseUrl, signedUrl, previewUrl, from: bgTargetUrl, threshold: bgTolerance })
      setBgResultUrl(previewUrl || null)
    } catch (e: any) {
      setBgError(e?.message || 'Failed to remove background')
    } finally {
      setBgIsProcessing(false)
    }
  }
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const designRef = useRef<HTMLDivElement | null>(null)

  // Fallback print area if mockup-templates are unavailable
  const getTemplate = (place: string): TemplatePlacement | undefined => {
    // Prefer exact layout template when available
    if (layoutTemplate && layoutTemplate.placement === place) {
      const cw = canvasRef.current?.clientWidth || layoutTemplate.templateW || 900
      const scale = (layoutTemplate.templateW || cw) > 0 ? cw / (layoutTemplate.templateW || cw) : 1
      return {
        placement: place,
        width: Math.round(layoutTemplate.areaW * scale),
        height: Math.round(layoutTemplate.areaH * scale),
        x: Math.round(layoutTemplate.areaX * scale),
        y: Math.round(layoutTemplate.areaY * scale),
        view_image: layoutTemplate.imageUrl || null,
      }
    }
    const found = templates.find((t) => t.placement === place)
    if (found && found.width > 0 && found.height > 0) return found
    const cw = canvasRef.current?.clientWidth || 900
    const p = (place || 'front').toLowerCase()
    if (p.includes('left') || p.includes('right')) {
      // Sleeves: narrow, tall area toward sides
      const areaW = Math.round(cw * 0.18)
      const areaH = Math.round(cw * 0.45)
      const y = Math.round(cw * 0.24)
      const x = p.includes('left') ? Math.round(cw * 0.18) : Math.round(cw - areaW - cw * 0.18)
      return { placement: place, width: areaW, height: areaH, x, y, view_image: null }
    }
    // Front/back: centered
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

  // Load legacy mockup templates for the product (fallback imagery only)
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
      } catch {}
    })()
    return () => { mounted = false }
  }, [productId])

  // Prefetch product route for smoother back
  useEffect(() => {
    try { router.prefetch(`/catalog/product/${productId}`) } catch {}
  }, [router, productId])

  // Load real garment images (fallback imagery only)
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

  // Load layout templates + printfiles and resolve exact print area per variant + placement
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const v1ProductId = (product && (product as any).id) ? (product as any).id : productId
        // 1) Resolve v1 variant_id by color+size
        let v1variant: number | null = null
        try {
          const vres = await fetch(`/api/printful/variants?product_id=${v1ProductId}`)
          if (vres.ok) {
            const vj = await vres.json()
            const list: any[] = vj?.result || []
            const match = list.find((v: any) => String(v.size||'')===String(size||'') && String(v.color||'')===String(color||''))
            v1variant = match?.variant_id ?? null
          }
        } catch {}
        if (!mounted) return
        setVariantId(v1variant)

        // 2) Fetch layout templates
        const tres = await fetch(`/api/printful/templates?product_id=${v1ProductId}`)
        if (!tres.ok) return
        const tjson = await tres.json()
        const tplResult = tjson?.result || {}
        const templatesArr: any[] = Array.isArray(tplResult?.templates) ? tplResult.templates : []
        const mappingArr: any[] = Array.isArray(tplResult?.variant_mapping) ? tplResult.variant_mapping : []

        // Compute available placements for this variant
        const normalize = (s: string) => {
          const v = String(s || '').toLowerCase()
          if (v.includes('sleeve_left')) return 'left'
          if (v.includes('sleeve_right')) return 'right'
          if (v.includes('back')) return 'back'
          if (v.includes('front')) return 'front'
          return ''
        }
        if (v1variant) {
          const vm = mappingArr.find((m: any) => Number(m?.variant_id) === Number(v1variant))
          const raw: string[] = Array.isArray(vm?.templates) ? vm.templates.map((t: any) => normalize(String(t?.placement || ''))) : []
          const allowedSet = new Set<string>(raw.filter((p: string) => p && ['front','back','left','right'].includes(p)))
          setAvailablePlacements(Array.from(allowedSet) as string[])
        } else {
          setAvailablePlacements([])
        }

        // Determine template_id for our variant+placement
        let templateId: number | null = null
        if (v1variant) {
          const vm = mappingArr.find((m: any) => Number(m?.variant_id) === Number(v1variant))
          const tForPlacement = Array.isArray(vm?.templates)
            ? (vm.templates.find((t: any) => String(t?.placement||'').toLowerCase() === String(placement).toLowerCase())
              || vm.templates.find((t: any) => String(t?.placement||'').toLowerCase().includes(placement)))
            : null
          templateId = Number(tForPlacement?.template_id) || null
        }
        // Fallback: pick any template matching placement
        if (!templateId) {
          const anyT = templatesArr.find((t: any) => String(t?.placement||'').toLowerCase() === String(placement).toLowerCase())
            || templatesArr.find((t: any) => String(t?.placement||'').toLowerCase().includes(placement))
          templateId = Number(anyT?.template_id) || null
        }
        if (!templateId) return
        const selected = templatesArr.find((t: any) => Number(t?.template_id) === templateId)
        if (!selected) return

        const lt = {
          placement,
          templateW: Number(selected?.template_width || 0),
          templateH: Number(selected?.template_height || 0),
          areaX: Number(selected?.print_area_left || 0),
          areaY: Number(selected?.print_area_top || 0),
          areaW: Number(selected?.print_area_width || 0),
          areaH: Number(selected?.print_area_height || 0),
          imageUrl: selected?.image_url || null,
          backgroundUrl: selected?.background_url || null,
          backgroundColor: selected?.background_color || null,
        }
        if (!mounted) return
        setLayoutTemplate(lt)
        // Use template image for consistent base
        if (lt.imageUrl) setActiveMockup(lt.imageUrl)
      } catch {}
    })()
    return () => { mounted = false }
  }, [productId, color, size, placement])

  // Ensure current placement is valid for this variant; pick a default if not
  useEffect(() => {
    if (availablePlacements.length === 0) return
    if (!availablePlacements.includes(placement)) {
      const next = availablePlacements.includes('front') ? 'front' : availablePlacements[0]
      setPlacement(next)
    }
  }, [availablePlacements])

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

  // Merge realtime-generated URLs with persisted B2 designs for immediate visibility
  const mergedDesigns = useMemo(() => {
    const set = new Set<string>()
    for (const u of (latestGeneratedUrls || [])) if (u) set.add(u)
    for (const u of designs) if (u) set.add(u)
    return Array.from(set)
  }, [latestGeneratedUrls, designs])

  const submitEdit = async () => {
    if (!editingUrl || !editPrompt.trim()) return
    try {
      setSubmittingEdit(true)
      setEditError(null)
      const resp = await fetch(editingUrl, { cache: 'no-store' })
      const blob = await resp.blob()
      const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1] || '')
        r.onerror = (e) => reject(e)
        r.readAsDataURL(b)
      })
      const data64 = await toBase64(blob)
      const res = await fetch('/api/generate/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data64, prompt: editPrompt.trim() })
      })
      if (!res.ok) throw new Error('Edit failed')
      const out = await res.json()
      const newUrl = out?.result_url
      if (newUrl) {
        setDesigns((prev) => [newUrl, ...prev])
      }
      setIsEditing(false)
      setEditingUrl(null)
      setEditPrompt('')
    } catch (e: any) {
      setEditError(e?.message || 'Edit failed')
    } finally {
      setSubmittingEdit(false)
    }
  }

  // Load natural dimensions of the selected design to preserve aspect ratio
  useEffect(() => {
    if (!designUrl) { setDesignDims(null); return }
    const ImgCtor: any = typeof window !== 'undefined' && (window as any).Image ? (window as any).Image : (globalThis as any).Image
    const img = new ImgCtor()
    img.onload = () => {
      const w = (img as HTMLImageElement).naturalWidth || 0
      const h = (img as HTMLImageElement).naturalHeight || 0
      if (w > 0 && h > 0) setDesignDims({ w, h })
    }
    img.src = designUrl
    return () => { img.onload = null as any }
  }, [designUrl])

  // Fit the design inside the print area by default
  useEffect(() => {
    const tpl = getTemplate(placement)
    if (!tpl) return
    const areaW = tpl.width
    const areaH = tpl.height
    const x0 = tpl.x
    const y0 = tpl.y
    const pad = 4
    // Preserve aspect ratio of the design if known; otherwise use a reasonable default
    if (designDims) {
      const maxW = Math.max(40, areaW - pad * 2)
      const maxH = Math.max(40, areaH - pad * 2)
      const s = Math.min(maxW / designDims.w, maxH / designDims.h)
      const w = Math.max(40, Math.floor(designDims.w * s))
      const h = Math.max(40, Math.floor(designDims.h * s))
      // center inside print area
      const cx = x0 + Math.floor((areaW - w) / 2)
      const cy = y0 + Math.floor((areaH - h) / 2)
      setDesignRect({ x: cx, y: cy, w, h, r: 0 })
    } else {
      // Default to 60% of print area while keeping it obviously smaller than full area
      const w = Math.max(40, Math.floor((areaW - pad * 2) * 0.6))
      const h = Math.max(40, Math.floor((areaH - pad * 2) * 0.6))
      const cx = x0 + Math.floor((areaW - w) / 2)
      const cy = y0 + Math.floor((areaH - h) / 2)
      setDesignRect({ x: cx, y: cy, w, h, r: 0 })
    }
  }, [templates, placement, layoutTemplate, designDims])

  // Initial clear when the designer mounts so no design is preselected
  useEffect(() => {
    setDesignUrl('')
  }, [])

  // When placement changes, restore any previously selected design for that placement; otherwise clear and refit
  useEffect(() => {
    const key = (placement || 'front') as 'front'|'back'|'left'|'right'
    const saved = designsByPlacement[key]
    if (saved?.url) {
      setDesignUrl(saved.url)
      const tpl = getTemplate(placement)
      if (tpl && saved.transform) {
        const x = tpl.x + Math.round((saved.transform.x || 0) * tpl.width)
        const y = tpl.y + Math.round((saved.transform.y || 0) * tpl.height)
        const w = Math.max(40, Math.round((saved.transform.w || 0) * tpl.width))
        const h = Math.max(40, Math.round((saved.transform.h || 0) * tpl.height))
        const r = saved.transform.rotationDeg || 0
        setDesignRect({ x, y, w, h, r })
      } else {
        onFitArea()
      }
    } else {
      setDesignUrl('')
      onFitArea()
    }
    // Intentionally do NOT depend on designsByPlacement to avoid update loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placement])

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
    // Persist per-placement selection if a design is chosen
    if (designUrl) setDesignForPlacement(p, { url: designUrl, transform: { x: nx, y: ny, w: nw, h: nh, rotationDeg: rot } })
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

  // Update mockup image according to placement and color (fallback only when no layout template)
  useEffect(() => {
    if (layoutTemplate?.imageUrl) return
    const p = String(placement)
    const candidates = images.filter((i) => String(i.placement || '').toLowerCase().includes(p))
    const byColor = candidates.find((i) => colorMatches(i.color_name, color))
    const pick = byColor || candidates[0]
    if (pick?.image_url) setActiveMockup(pick.image_url)
    setCanvasBg(((pick?.background_color as string) || colorHexParam || null))
  }, [images, placement, color, colorHexParam, layoutTemplate?.imageUrl])

  // Sync print area to flow
  useEffect(() => {
    const key = (placement || '').toLowerCase()
    const mapped = key.includes('back') ? 'Back' : 'Front'
    setPrintArea(mapped as any)
  }, [placement, setPrintArea])

  // Drag/scale/rotate handlers (simple)
  const onDrag: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!designRef.current || !canvasRef.current) return
    e.preventDefault()
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
    const areaW = tpl.width
    const areaH = tpl.height
    const x0 = tpl.x
    const y0 = tpl.y
    const pad = 4
    if (designDims) {
      const maxW = Math.max(40, areaW - pad * 2)
      const maxH = Math.max(40, areaH - pad * 2)
      const s = Math.min(maxW / designDims.w, maxH / designDims.h)
      const w = Math.max(40, Math.floor(designDims.w * s))
      const h = Math.max(40, Math.floor(designDims.h * s))
      const cx = x0 + Math.floor((areaW - w) / 2)
      const cy = y0 + Math.floor((areaH - h) / 2)
      setDesignRect({ x: cx, y: cy, w, h, r: 0 })
    } else {
      const w = Math.max(40, Math.floor((areaW - pad * 2) * 0.6))
      const h = Math.max(40, Math.floor((areaH - pad * 2) * 0.6))
      const cx = x0 + Math.floor((areaW - w) / 2)
      const cy = y0 + Math.floor((areaH - h) / 2)
      setDesignRect({ x: cx, y: cy, w, h, r: 0 })
    }
  }

  const placementsAvail = useMemo(() => {
    if (availablePlacements.length > 0) return availablePlacements
    const ps = new Set<string>()
    for (const t of templates) {
      const p = String(t.placement || '').toLowerCase()
      if (p.includes('label') || p.includes('embroid')) continue
      if (p.includes('front')) ps.add('front')
      else if (p.includes('back')) ps.add('back')
      else if (p.includes('left')) ps.add('left')
      else if (p.includes('right')) ps.add('right')
    }
    for (const i of images) {
      const p = String(i.placement || '').toLowerCase()
      if (p.includes('label') || p.includes('embroid')) continue
      if (p.includes('front')) ps.add('front')
      else if (p.includes('back')) ps.add('back')
      else if (p.includes('left')) ps.add('left')
      else if (p.includes('right')) ps.add('right')
    }
    return ['front','back','left','right'].filter((p) => ps.has(p))
  }, [availablePlacements, templates, images])

  // Generate flow (AI tab)
  const handleGenerate = async () => {
    const rawPrompt = prompt.trim()
    if (!rawPrompt) return
    try {
      setGenerating(true)
      setFlowStyle(selectedStyle || 'Standard')
      setFlowPrompt(rawPrompt)
      
      // Step 1: Parse prompt
      const parseRes = await fetch('/api/parse-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: rawPrompt, style: selectedStyle || undefined }),
      })
      
      const parseData = parseRes.ok ? await parseRes.json() : null
      const expandedPrompt = parseData?.expandedPrompt || rawPrompt
      
      // Step 2: Queue generation job
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: rawPrompt,
          expandedPrompt: expandedPrompt,
          style: selectedStyle || 'Standard',
          franchise: parseData?.franchise || null,
          width: 1024,
          height: 1024,
        }),
      })
      
      if (!genRes.ok) {
        console.error('[designer] Generation failed:', genRes.status)
        return
      }
      
      const genData = await genRes.json()
      const jobId = genData.jobId
      
      if (!jobId) {
        console.error('[designer] No job ID returned')
        return
      }
      
      console.log('[designer] Generation queued:', jobId)
      
      // Step 3: Poll for job completion
      const maxPollTime = 120000 // 2 minutes max
      const pollInterval = 2000 // 2 seconds
      const startTime = Date.now()
      
      while (Date.now() - startTime < maxPollTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
        const statusRes = await fetch(`/api/generate/status/${jobId}`)
        if (!statusRes.ok) continue
        
        const status = await statusRes.json()
        console.log('[designer] Job status:', status.status)
        
        // Show partials if available
        const partial = [status?.result_url, ...((status?.metadata?.extra_urls || []))].filter((u: any) => !!u && typeof u === 'string')
        if (partial.length > 0 && !designUrl) {
          setDesignUrl(partial[0])
          onFitArea()
        }

        if (status.status === 'completed' && status.result_url) {
          // Success! Set the design URL to the first result (users can choose others)
          console.log('[designer] Generation complete:', status.result_url)
          setDesignUrl(status.result_url)
          onFitArea()
          await refreshDesigns()
          break
        } else if (status.status === 'failed') {
          console.error('[designer] Generation failed:', status.error)
          alert(`Generation failed: ${status.error || 'Unknown error'}`)
          break
        }
        // Otherwise keep polling (status is 'queued' or 'processing')
      }
      
      // Timeout check
      if (Date.now() - startTime >= maxPollTime) {
        console.warn('[designer] Generation timeout')
        alert('Generation is taking longer than expected. Check your designs list in a few minutes.')
      }
      
    } catch (err) {
      console.error('[designer] Generation error:', err)
      alert('Failed to generate image. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main className="min-h-[70vh] px-4 sm:px-6 lg:px-10 py-6 max-w-[1600px] mx-auto text-white">
      {/* Live generation banner and thumbnails (realtime) */}
      {isGenerating && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-200">
          <div className="flex items-center gap-3">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-amber-200/60 border-t-white animate-spin" aria-hidden />
            <div className="text-sm">
              Generating your design…
              {latestGeneratedUrls?.length ? (
                <span className="ml-2 text-amber-100/90">{latestGeneratedUrls.length}/3 ready</span>
              ) : null}
            </div>
          </div>
          {!!latestGeneratedUrls?.length && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {latestGeneratedUrls.slice(0, 3).map((u) => (
                <button key={u} onClick={() => { setDesignUrl(u); onFitArea() }} className="relative aspect-square rounded-md overflow-hidden border border-amber-400/30 bg-white/[0.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="variant" className="w-full h-full object-contain" style={{ backgroundColor: 'transparent' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
      <div className="grid grid-cols-[72px_420px_minmax(0,1fr)] gap-5">
        {/* Vertical icon sidebar */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 flex flex-col items-center gap-2">
          <button
            title="AI"
            onClick={() => setActiveTab('ai')}
            className={`${activeTab==='ai' ? 'border-amber-400/40 bg-white/[0.10]' : 'border-white/10 hover:border-white/20 bg-white/[0.05]'} w-10 h-10 flex items-center justify-center rounded-lg border`}
          >
            <Sparkles className="w-5 h-5" />
          </button>
          <button
            title="Uploads"
            onClick={() => setActiveTab('uploads')}
            className={`${activeTab==='uploads' ? 'border-amber-400/40 bg-white/[0.10]' : 'border-white/10 hover:border-white/20 bg-white/[0.05]'} w-10 h-10 flex items-center justify-center rounded-lg border`}
          >
            <Upload className="w-5 h-5" />
          </button>
          <button
            title="Text"
            onClick={() => setActiveTab('text')}
            className={`${activeTab==='text' ? 'border-amber-400/40 bg-white/[0.10]' : 'border-white/10 hover:border-white/20 bg-white/[0.05]'} w-10 h-10 flex items-center justify-center rounded-lg border`}
          >
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
              {mergedDesigns.length > 0 && (
                <div>
                  <div className="text-sm text-white/60 mb-2">Your designs</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-5">
                    {mergedDesigns.map((u, i) => (
                      <div
                        key={`${u}-${i}`}
                        className="group relative aspect-[4/5] rounded-lg overflow-hidden border border-white/10 bg-[linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.06)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,rgba(255,255,255,0.06)_75%),linear-gradient(-45deg,transparent_75%,rgba(255,255,255,0.06)_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0]"
                        onClick={() => { openAddToProduct(u) }}
                        role="button"
                        aria-label="Use design"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="design" className="w-full h-full object-contain" style={{ backgroundColor: 'transparent' }} />
                        {/* Shading overlay (no clicks) */}
                        <div className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 pointer-events-none" />
                        {/* Centered toolbar (on top, clickable) */}
                        <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="rounded-full bg-white/92 text-black backdrop-blur-md ring-1 ring-black/10 px-3 py-2 flex items-center gap-3 pointer-events-auto shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                            <button onClick={(e) => { e.stopPropagation(); openAddToProduct(u) }} className="p-2 rounded-md hover:bg-white" title="Add to product" aria-label="Add to product">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" d="M12 5v14m-7-7h14"/></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingUrl(u); setEditPrompt(''); setIsEditing(true); }} className="p-2 rounded-md hover:bg-white" title="Edit" aria-label="Edit">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" d="M12 20h9"/><path strokeWidth="2" d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            </button>
                            <button onClick={async (e) => { e.stopPropagation(); try { const resp = await fetch('/api/designs/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: u }) }); if (resp.ok) { setDesigns((prev) => prev.filter((x) => x !== u)) } } catch {} }} className="p-2 rounded-md hover:bg-white" title="Delete" aria-label="Delete">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeWidth="2" d="M3 6h18"/><path strokeWidth="2" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path strokeWidth="2" d="M10 11v6M14 11v6"/><path strokeWidth="2" d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
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
              <button
                onClick={() => {
                  const p = (placement || 'front') as 'front'|'back'|'left'|'right'
                  setDesignUrl('')
                  setDesignForPlacement(p, undefined)
                  onFitArea()
                }}
                className="px-2 py-1.5 rounded-md border border-white/10 bg-white/[0.06] text-xs"
              >Remove</button>
              <button
                onClick={async () => {
                  try {
                    // Persist draft to sessionStorage for finalize page only
                    const draft = {
                      product_id: productId,
                      color: color || null,
                      size: size || null,
                      designs_by_placement: designsByPlacement,
                      prompt: prompt || null,
                      style: selectedStyle || null,
                      ts: Date.now(),
                    }
                    if (typeof window !== 'undefined') {
                      window.sessionStorage.setItem('designDraft', JSON.stringify(draft))
                    }
                    const finalizePath = `/designer/${productId}/finalize`
                    if (!userEmail) {
                      setShowAuthPrompt(true)
                    } else {
                      router.push(finalizePath)
                    }
                  } catch {}
                }}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium btn-shimmer text-xs"
              >Confirm design</button>
            </div>
          </div>

          <div className="mt-3 relative overflow-auto">
            <div
              ref={canvasRef}
              className="relative mx-auto max-w-[1200px]"
              style={{
                backgroundColor: (canvasBg as string | undefined) || (layoutTemplate?.backgroundColor as string | undefined) || undefined,
                backgroundImage: layoutTemplate?.backgroundUrl ? `url(${layoutTemplate.backgroundUrl})` : undefined,
                backgroundSize: layoutTemplate?.backgroundUrl ? 'cover' : undefined,
                backgroundPosition: layoutTemplate?.backgroundUrl ? 'center' : undefined,
                backgroundRepeat: layoutTemplate?.backgroundUrl ? 'no-repeat' : undefined,
              }}
            >
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
              {/* Design rect */}
              <div
                ref={designRef}
                onMouseDown={onDrag}
                onWheel={onWheel}
                style={{ position: 'absolute', left: designRect.x, top: designRect.y, width: designRect.w, height: designRect.h, transform: `rotate(${designRect.r}deg)` }}
                className={`group rounded-md ${isMoving ? 'cursor-grabbing border-2 border-white/50' : 'cursor-grab border border-transparent hover:border-white/30'}`}
              >
                {designUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={designUrl} alt="design" className="w-full h-full object-contain select-none" onDragStart={(e) => e.preventDefault()} />
                ) : (
                  <div className="w-full h-full grid place-items-center text-xs text-white/50">Pick a design</div>
                )}
                {/* Floating edit button over the design */}
                {designUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingUrl(designUrl); setEditPrompt(''); setIsEditing(true) }}
                    className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white text-black shadow-md flex items-center justify-center border border-black/10"
                    title="Edit"
                    aria-label="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth prompt modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-[#0b0b0b] text-white overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="font-medium">Edit Image</div>
              <button onClick={() => setIsEditing(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="p-3 border-b md:border-b-0 md:border-r border-white/10">
                {editingUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingUrl} alt="Editing" className="w-full h-[360px] object-contain" />
                )}
              </div>
              <div className="p-3 space-y-4">
                <div>
                  <label className="text-sm text-white/70">Describe the edit (AI)</label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={5}
                    placeholder="e.g., clean stray edges, increase contrast, refine lines"
                    className="w-full mt-2 rounded-lg bg-white/[0.04] border border-white/10 p-2 outline-none"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button disabled={isSubmittingEdit || !editPrompt.trim()} onClick={submitEdit} className="px-3 py-2 rounded bg-blue-500 hover:bg-blue-600 disabled:opacity-50">
                      {isSubmittingEdit ? 'Applying…' : 'Apply AI edit'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="text-sm text-white/80 mb-1">Background removal tolerance</div>
                  <input
                    type="range"
                    min={200}
                    max={255}
                    step={1}
                    value={bgTolerance}
                    onChange={(e) => setBgTolerance(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-xs text-white/60 mt-1">Tolerance: {bgTolerance}</div>
                  <div className="mt-2">
                    <button
                      onClick={async () => {
                        if (!editingUrl) return
                        try {
                          setBgIsProcessing(true)
                          setBgError(null)
                          const res = await fetch('/api/images/remove-bg', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: editingUrl, threshold: bgTolerance }),
                          })
                          if (res.ok) {
                            const j = await res.json()
                            const outUrl = j?.url || null
                            if (outUrl) {
                              setDesignUrl(outUrl)
                              // refresh preview
                              setEditingUrl(outUrl)
                            }
                          }
                        } catch (e: any) {
                          setBgError(e?.message || 'Failed')
                        } finally {
                          setBgIsProcessing(false)
                        }
                      }}
                      disabled={bgIsProcessing}
                      className="px-3 py-2 rounded-md bg-white text-black hover:opacity-90"
                    >
                      {bgIsProcessing ? 'Processing…' : 'Apply remove background'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="text-sm text-white/80 mb-2">Post-processing filters</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['sharpen','Sharpen'],
                      ['normalize','Normalize'],
                      ['grayscale','Grayscale'],
                      ['invert','Invert'],
                      ['blur','Light blur'],
                      ['saturation_plus','Saturation +'],
                      ['saturation_minus','Saturation -'],
                      ['tint_warm','Warm tint'],
                      ['tint_cool','Cool tint'],
                    ].map(([key,label]) => (
                      <button
                        key={key}
                        onClick={async () => {
                          if (!editingUrl) return
                          try {
                            setBgIsProcessing(true)
                            setBgError(null)
                            const res = await fetch('/api/images/postprocess', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url: editingUrl, operations: [key] }),
                            })
                            if (res.ok) {
                              const j = await res.json()
                              const outUrl = j?.url || null
                              if (outUrl) {
                                setDesignUrl(outUrl)
                                setEditingUrl(outUrl)
                              }
                            }
                          } catch (e: any) {
                            setBgError(e?.message || 'Failed')
                          } finally {
                            setBgIsProcessing(false)
                          }
                        }}
                        className="px-2 py-1.5 text-xs rounded-md border border-white/10 hover:bg-white/[0.06]"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {editError && <div className="text-rose-300 text-xs">{editError}</div>}
                {bgError && <div className="text-rose-300 text-xs">{bgError}</div>}
                <div className="pt-2 flex items-center gap-2">
                  <button onClick={() => setIsEditing(false)} className="px-3 py-2 rounded border border-white/15">Close</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAuthPrompt && !userEmail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] p-5">
            <div className="text-white/90 font-medium mb-1">Sign in to continue</div>
            <div className="text-white/60 text-sm mb-4">You need to login to save your design and create the order.</div>
            <div className="flex gap-3">
              <a href={`/signin?returnUrl=${encodeURIComponent(`/designer/${productId}/finalize`)}`} className="px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition text-sm">Sign In</a>
              <a href={`/signup?returnUrl=${encodeURIComponent(`/designer/${productId}/finalize`)}`} className="px-4 py-2 rounded-full bg-white text-black hover:opacity-90 transition text-sm">Sign Up</a>
              <button onClick={() => setShowAuthPrompt(false)} className="ml-auto px-3 py-1.5 rounded-md border border-white/10 text-white/70 text-xs">Close</button>
            </div>
          </div>
        </div>
      )}
      {showBgPrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0b0b0b] text-white overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="font-medium">Add to product</div>
              <button onClick={() => setShowBgPrompt(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                {(bgResultUrl || bgTargetUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={bgResultUrl || bgTargetUrl!}
                    src={bgResultUrl || bgTargetUrl!}
                    alt="preview"
                    className="w-full h-[320px] object-contain"
                    onError={() => setBgError(`Preview failed to load: ${bgResultUrl || bgTargetUrl}`)}
                  />
                ) : (
                  <div className="w-full h-[320px] grid place-items-center text-xs text-white/60">No preview</div>
                )}
                {(bgResultUrl || bgTargetUrl) && (
                  <div className="mt-2 text-[11px] text-white/60 break-all">
                    Preview URL: {bgResultUrl || bgTargetUrl}
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-white/80 mb-2">Remove white background?</div>
                <div className="text-xs text-white/60 mb-3">Choose tolerance (higher removes more near-white).</div>
                <input
                  type="range"
                  min={200}
                  max={255}
                  step={1}
                  value={bgTolerance}
                  onChange={(e) => setBgTolerance(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-white/60 mt-1">Tolerance: {bgTolerance}</div>
                {bgError && <div className="text-rose-300 text-xs mt-2">{bgError}</div>}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={confirmKeepBackground}
                    disabled={bgIsProcessing}
                    className="px-3 py-2 rounded-md border border-white/15 hover:bg-white/[0.06]"
                  >
                    Keep background
                  </button>
                  <button
                    onClick={confirmRemoveBackground}
                    disabled={bgIsProcessing}
                    className="px-3 py-2 rounded-md bg-white text-black hover:opacity-90"
                  >
                    {bgIsProcessing ? 'Processing…' : 'Remove background'}
                  </button>
                  {!!bgResultUrl && (
                    <button
                      onClick={() => {
                        setDesignUrl(bgResultUrl)
                        onFitArea()
                        setShowBgPrompt(false)
                      }}
                      className="px-3 py-2 rounded-md bg-amber-300 text-black hover:bg-amber-200"
                    >
                      Add to product
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}