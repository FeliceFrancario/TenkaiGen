'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { STYLES } from '@/lib/styles'
import { useFlow } from '@/components/flow-provider'

export type CatalogProduct = {
  id: number
  catalog_product_id?: number | string | null
  title: string
  description?: string
  brand?: string | null
  model?: string | null
  sizes?: string[]
  colors?: { name: string; value?: string | null }[]
  image?: string | null
  variants: Array<{
    id: number
    name: string
    size?: string | null
    color?: string | null
    color_code?: string | null
    image?: string | null
  }>
}

export default function CatalogProductDetail({ product }: { product: CatalogProduct }) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined)
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined)
  const [selectedStyle, setSelectedStyle] = useState<string | undefined>(undefined)
  const [prompt, setPrompt] = useState('')
  const { isGenerating, setGenerating } = useFlow()

  // Images from v2 endpoint (placement + background info)
  type PlImage = { placement: string; image_url: string; color_name?: string | null; background_color?: string | null; background_image?: string | null }
  const [plImages, setPlImages] = useState<PlImage[]>([])
  const [placement, setPlacement] = useState<string>('front')
  type ScoredImage = PlImage & { _score: number; _key: string }
  const [allImages, setAllImages] = useState<ScoredImage[]>([])
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)

  // Local size sorting since util was removed
  const sortSizesLocal = (arr: string[]) => {
    const order = ['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL']
    const idx = (s: string) => {
      const up = s.toUpperCase().replace(/\s+/g,'')
      const oi = order.indexOf(up)
      if (oi >= 0) return oi
      const n = parseInt(up, 10)
      if (!Number.isNaN(n)) return 100 + n
      if (/ONE\s*SIZE|OS/i.test(s)) return 200
      return 300
    }
    return [...arr].sort((a, b) => idx(a) - idx(b))
  }

  const colors = useMemo(() => {
    // Derive from variants first (more reliable), fallback to product.colors
    const fromVariants: { name: string; code?: string | null }[] = []
    for (const v of product.variants || []) {
      const name = v.color || undefined
      if (!name) continue
      if (!fromVariants.find((c) => c.name === name)) {
        fromVariants.push({ name, code: v.color_code })
      }
    }
    if (fromVariants.length) return fromVariants
    return (product.colors || []).map((c) => ({ name: c.name, code: c.value }))
  }, [product])

  const sizes = useMemo(() => {
    const set = new Set<string>()
    for (const v of product.variants || []) {
      if (v.size) set.add(String(v.size))
    }
    if (set.size) return sortSizesLocal(Array.from(set))
    return sortSizesLocal(product.sizes || [])
  }, [product])

  useEffect(() => {
    if (!selectedColor && colors.length) setSelectedColor(colors[0]?.name)
  }, [colors, selectedColor])

  useEffect(() => {
    if (!selectedSize && sizes.length) setSelectedSize(sizes[0])
  }, [sizes, selectedSize])

  const activeVariant = useMemo(() => {
    // Try exact match
    let v = product.variants.find((vv) => (selectedColor ? vv.color === selectedColor : true) && (selectedSize ? vv.size === selectedSize : true))
    if (v) return v
    // Try color-only
    v = product.variants.find((vv) => (selectedColor ? vv.color === selectedColor : true))
    if (v) return v
    // Fallback to first
    return product.variants[0]
  }, [product, selectedColor, selectedSize])

  // Normalize placement keys and labels
  const normPlacement = (p: string) => {
    const s = (p || '').toLowerCase()
    if (s.includes('front')) return { key: 'front', label: 'Front' }
    if (s.includes('back')) return { key: 'back', label: 'Back' }
    if (s.includes('sleeve_left') || s === 'left') return { key: 'left', label: 'Left sleeve' }
    if (s.includes('sleeve_right') || s === 'right') return { key: 'right', label: 'Right sleeve' }
    return { key: s || 'front', label: (p || 'Front').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) }
  }

  // Helper: classify mockup style from URL for ordering
  const styleRank = (url: string) => {
    const u = String(url).toLowerCase()
    if (/(onman\b|\bmen\b|onwoman|womens|women\b|model)/i.test(u)) return 0 // model first
    if (/ghost/.test(u)) return 1
    if (/flat/.test(u)) return 2
    return 3
  }
  const normUrl = (u: string) => String(u || '').split('?')[0]

  // Prefer baked (jpg/webp) over transparent (png) assets when available
  const fileExtRank = (url: string) => {
    const u = normUrl(url).toLowerCase()
    if (/(\.jpg|\.jpeg|\.webp)$/.test(u)) return 0
    if (/\.png$/.test(u)) return 1
    return 2
  }

  const isPng = (url?: string | null) => !!url && /\.png($|\?)/i.test(String(url))

  // Model-only filter (remove flat/ghost); fallback to all if none
  const isModelUrl = (url?: string | null) => {
    const u = String(url || '').toLowerCase()
    if (!u) return false
    if (/flat|ghost/.test(u)) return false
    return /(onman|onmale|\bmen\b|male|guy|onwoman|onfemale|womens|women\b|female|girl|model|lifestyle)/i.test(u)
  }

  // Gender helpers and preference
  const isMaleModel = (url: string) => /(onman\b|\bmen\b|male|guy)/i.test(String(url))
  const isFemaleModel = (url: string) => /(onwoman|womens|women\b|female|girl)/i.test(String(url))
  const genderPrefRank = (url: string) => (isMaleModel(url) ? 0 : isFemaleModel(url) ? 1 : 2)
  // User requested more men models
  const preferMenModels = true

  // Helper: color matching across varying metadata
  const colorMatches = (img: PlImage, selName?: string, selHex?: string | null) => {
    const bgHex = normalizeHex(img.background_color || null)
    if (selHex && bgHex && selHex === bgHex) return true
    if (!selName) return false
    // Exact color name match from API (most reliable)
    const imgColor = String(img.color_name || '').trim().toLowerCase()
    const selColor = String(selName || '').trim().toLowerCase()
    if (imgColor && selColor && imgColor === selColor) return true
    // Normalized name equality (generic, no fuzzy tokens)
    const sanitize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const imgNorm = sanitize(imgColor)
    const selNorm = sanitize(selColor)
    if (imgNorm && selNorm && imgNorm === selNorm) return true
    return false
  }

  // Detect if current color selection is heather/textured, so we prefer a background image texture over flat color when using transparent PNGs
  const isHeatherSelected = useMemo(() => {
    const n = String(selectedColor || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return /heather|athleticheather|darkheather|ash|oatmeal|triblend|marble|slub/.test(n)
  }, [selectedColor])

  // Gender context derived from product title and active variant
  const { womensSelected, mensSelected, unisexSelected } = useMemo(() => {
    const t = product.title || ''
    const vname = activeVariant?.name || ''
    const womens = /women|ladies|women's/i.test(t) || /women|ladies|women's/i.test(vname)
    const mens = /men|men's\b/i.test(t) || /men|men's\b/i.test(vname)
    const unisex = /unisex/i.test(t) || /unisex/i.test(vname)
    return { womensSelected: womens && !mens, mensSelected: mens && !womens, unisexSelected: unisex }
  }, [product.title, activeVariant?.name])

  // Selected color hex resolver
  const normalizeHex = (hex?: string | null): string | null => {
    if (!hex) return null
    let h = String(hex).trim().replace(/^#/, '')
    if (!/^[0-9a-fA-F]{3,8}$/.test(h)) return null
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    if (h.length >= 6) h = h.slice(0, 6)
    return `#${h.toUpperCase()}`
  }
  const selectedColorHex = useMemo(() => {
    const match = colors.find((c) => c.name === selectedColor)
    const fromSelected = normalizeHex(match?.code || null)
    if (fromSelected) return fromSelected
    const fromVariant = normalizeHex(activeVariant?.color_code || null)
    if (fromVariant) return fromVariant
    // Fallback: try to infer from any image that carries a background_color for this color
    const selName = String(selectedColor || '').toLowerCase()
    const imgMatch = allImages.find((i) => (
      String(i.color_name || '').toLowerCase() === selName) && !!normalizeHex(i.background_color || null)
    )
    const fromImages = normalizeHex(imgMatch?.background_color || null)
    return fromImages
  }, [activeVariant?.color_code, colors, selectedColor, allImages])

  // Fetch v2 images for placements and gallery
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const catalogId = (product as any).catalog_product_id || product.id
        const res = await fetch(`/api/printful/images?product_id=${catalogId}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        let list: PlImage[] = (json?.result || [])
        // Remove labeling and embroidery placements/assets completely
        const allowed = new Set(['front','back','left','right'])
        list = list.filter((it) => {
          const key = normPlacement(it.placement).key
          const p = String(it.placement || '').toLowerCase()
          const u = String(it.image_url || '').toLowerCase()
          if (!allowed.has(key)) return false
          if (p.includes('label') || p.includes('embroid')) return false
          if (u.includes('embroidery') || u.includes('/label')) return false
          return true
        })
        if (!mounted) return
        // Scoring preferences per placement: background_image > background_color; women's prefer onwoman/womens; unisex prefer ghost/flat
        const scored: ScoredImage[] = list.map((it) => {
          const url = it.image_url || ''
          let s = 0
          if (it.background_image) s += 4
          if (it.background_color) s += 1
          // prefer canonical front/back over "_large" only slightly
          const norm = normPlacement(it.placement).key
          if (norm === 'front') s += 1
          // Remove gender/unisex weighting to avoid unintended biases.
          return { ...it, _score: s, _key: norm }
        })
        // Save all scored images for gallery (stable sort by score desc), ensure non-empty src
        // Do NOT dedupe here; preserve duplicates across colors for same URL
        const allSorted = scored
          .filter((it) => !!(it.image_url && String(it.image_url).trim().length > 0))
          // Sort by style rank (model > ghost > flat > other), then score desc
          .sort((a, b) => {
            const r = styleRank(a.image_url) - styleRank(b.image_url)
            if (r !== 0) return r
            return b._score - a._score
          })
        setAllImages(allSorted)

        // Deduplicate by normalized key for placement options (restricted to allowed already), pick highest score
        const byKey = new Map<string, ScoredImage>()
        for (const it of scored) {
          const { key } = normPlacement(it.placement)
          const prev = byKey.get(key)
          if (!prev) {
            byKey.set(key, it)
          } else if (it._score > prev._score) {
            byKey.set(key, it)
          } else if (it._score === prev._score) {
            const prevOk = !!(prev.image_url && prev.image_url.trim().length > 0)
            const itOk = !!(it.image_url && it.image_url.trim().length > 0)
            if (itOk && !prevOk) byKey.set(key, it)
          }
        }
        const dedup = Array.from(byKey.values())
        setPlImages(dedup)
        // Default placement only if current placement is unset or not present
        const keys = dedup.map((i) => normPlacement(i.placement).key)
        if (!keys.includes(placement)) {
          const next = keys.includes('front') ? 'front' : (keys[0] || 'front')
          setPlacement(next)
        }
        // Clear manual selection if it no longer exists
        if (selectedImageUrl && !allSorted.find((i) => i.image_url === selectedImageUrl)) {
          setSelectedImageUrl(null)
        }
      } catch {}
    }
    load()
    return () => { mounted = false }
  }, [product.id, womensSelected, mensSelected, unisexSelected])

  // Pick image and background by selected placement or explicit thumbnail click
  const placementImage = useMemo(() => {
    const match = plImages.find((it) => normPlacement(it.placement).key === placement)
    return match || null
  }, [plImages, placement])

  const selectedItem = useMemo(() => {
    if (selectedImageUrl) return allImages.find((i) => i.image_url === selectedImageUrl) || null
    // Use all images for main pick so true per-color PNGs can be selected
    const matches = [...allImages]
    // Soft preference for current placement without filtering others
    const prefersPlacement = (_u: string, p: string) => (normPlacement(p).key === placement ? 0 : 1)
    matches.sort((a, b) => {
      // Prefer assets that match the selected color (so real per-color mockups swap in)
      const am = colorMatches(a, selectedColor, selectedColorHex) ? 0 : 1
      const bm = colorMatches(b, selectedColor, selectedColorHex) ? 0 : 1
      if (am !== bm) return am - bm
      // If both match color, prefer transparent PNGs to allow background colorization when needed
      const ap = isPng(a.image_url) ? 0 : 1
      const bp = isPng(b.image_url) ? 0 : 1
      if (am === 0 && bm === 0 && ap !== bp) return ap - bp
      if (preferMenModels) {
        const g = genderPrefRank(a.image_url) - genderPrefRank(b.image_url)
        if (g !== 0) return g
      }
      const pr = prefersPlacement(a.image_url, a.placement) - prefersPlacement(b.image_url, b.placement)
      if (pr !== 0) return pr
      const r = styleRank(a.image_url) - styleRank(b.image_url)
      if (r !== 0) return r
      const fe = fileExtRank(a.image_url) - fileExtRank(b.image_url)
      if (fe !== 0) return fe
      return b._score - a._score
    })
    return matches[0] || null
  }, [allImages, placement, selectedImageUrl, selectedColor, selectedColorHex])

  const activeImage = selectedItem?.image_url || activeVariant?.image || product.image || placementImage?.image_url || undefined

  // When the active image changes, reset measured dims so container aspect ratio re-computes.
  // This prevents background letterbox vs image ratio mismatches and flicker artifacts.
  useEffect(() => {
    setImgDims(null)
  }, [activeImage])

  // Resolve background (image/color) for the current placement that best matches the selected color
  const selectedBg = useMemo(() => {
    const placeKey = placement
    // Use the full images pool (not deduped by placement) so we can match color-specific backgrounds
    const candidates = allImages.filter((it) => normPlacement(it.placement).key === placeKey)
    const ranked = candidates
      .map((it) => ({ it, match: colorMatches(it, selectedColor, selectedColorHex) }))
      .sort((a, b) => {
        if (a.match !== b.match) return a.match ? -1 : 1
        const ai = a.it.background_image ? 1 : 0
        const bi = b.it.background_image ? 1 : 0
        if (ai !== bi) return bi - ai
        const ac = a.it.background_color ? 1 : 0
        const bc = b.it.background_color ? 1 : 0
        if (ac !== bc) return bc - ac
        return 0
      })
    return ranked[0]?.it || null
  }, [allImages, placement, selectedColor, selectedColorHex])

  const preferredBgColor = useMemo(() => {
    return selectedColorHex || normalizeHex(selectedBg?.background_color || null) || normalizeHex(placementImage?.background_color || null)
  }, [selectedBg?.background_color, placementImage?.background_color, selectedColorHex])

  // Only use a background image if: (1) active asset is a transparent PNG, (2) the selection is heather-like, and (3) the background matches the selected color
  const bgImageUrl = useMemo(() => {
    const transparent = isPng(activeImage)
    if (!transparent) return undefined
    if (!isHeatherSelected) return undefined
    const cand = selectedBg && colorMatches(selectedBg, selectedColor, selectedColorHex) ? selectedBg : null
    const fallback = !cand && placementImage && colorMatches(placementImage, selectedColor, selectedColorHex) ? placementImage : null
    const chosen = cand || fallback
    return chosen?.background_image || undefined
  }, [activeImage, selectedBg, placementImage, selectedColor, selectedColorHex, isHeatherSelected])

  const thumbs = useMemo(() => {
    let arr = allImages as ScoredImage[]
    // Keep consistent stack across colors; show only model images if available
    const models = arr.filter((i) => isModelUrl(i.image_url))
    arr = models.length ? models : arr
    // Filter invalid src
    arr = arr.filter((it) => !!(it.image_url && it.image_url.trim().length > 0))
    // Dedupe by base URL
    const seen = new Set<string>()
    const uniq = arr.filter((it) => {
      const key = normUrl(it.image_url)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    // Sort: prefer male models (if requested), then model>ghost>flat, then baked ext, then score
    const sorted = uniq.sort((a, b) => {
      if (preferMenModels) {
        const g = genderPrefRank(a.image_url) - genderPrefRank(b.image_url)
        if (g !== 0) return g
      }
      const r = styleRank(a.image_url) - styleRank(b.image_url)
      if (r !== 0) return r
      const fe = fileExtRank(a.image_url) - fileExtRank(b.image_url)
      if (fe !== 0) return fe
      return b._score - a._score
    })
    return sorted.slice(0, 8)
  }, [allImages])

  const handleGenerate = () => {
    // Placeholder: wire to generation backend later
    // For now, just log the intended payload
    console.log('[generate]', {
      product_id: product.id,
      color: selectedColor,
      size: selectedSize,
      style: selectedStyle || 'Standard',
      prompt: prompt.trim(),
    })
    // Temporary UX: simulate generation pending then complete
    setGenerating(true)
    setTimeout(() => setGenerating(false), 2000)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">
      {/* Left: imagery + variant selectors */}
      <div>
        <div className="mb-4">
          <h1 className="text-3xl font-semibold">{product.title}</h1>
          {product.brand && (
            <div className="text-white/60 text-sm mt-1">{product.brand}{product.model ? ` • ${product.model}` : ''}</div>
          )}
        </div>
        <div className="md:flex md:gap-3">
          {/* Thumbnails (desktop) */}
          <div className="hidden md:flex md:flex-col md:w-20 gap-2 overflow-auto max-h-[520px] pr-1">
            {thumbs.map((t) => {
              if (!t.image_url) return null
              const isActive = (selectedItem?.image_url || activeImage) === t.image_url
              return (
                <button
                  key={`${normUrl(t.image_url)}|${normPlacement(t.placement).key}`}
                  onClick={() => { setSelectedImageUrl(t.image_url) }}
                  className={`relative w-16 h-16 rounded-lg border overflow-hidden ${isActive ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]' : 'border-white/10 hover:border-white/20'}`}
                  style={{ backgroundColor: isPng(t.image_url) ? (selectedColorHex || t.background_color || 'transparent') : 'transparent' }}
                  title={normPlacement(t.placement).label}
                >
                  <Image src={t.image_url} alt="thumb" fill sizes="64px" className="object-cover" />
                </button>
              )
            })}
          </div>

          {/* Main image */}
          <div
            className="relative w-full rounded-xl overflow-hidden border border-white/10"
            style={{
              aspectRatio: (imgDims?.w && imgDims?.h) ? `${imgDims.w} / ${imgDims.h}` : undefined,
              // Use selected color for letterbox areas for ALL asset types; for transparent PNGs it will also color the garment
              backgroundColor: imgDims ? (preferredBgColor || 'transparent') : 'transparent',
              backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
              backgroundSize: bgImageUrl ? 'cover' : undefined,
              backgroundPosition: bgImageUrl ? 'center' : undefined,
              backgroundRepeat: bgImageUrl ? 'no-repeat' : undefined,
            }}
          >
            {activeImage ? (
              <Image
                src={activeImage}
                alt={product.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain"
                onLoadingComplete={(img) => {
                  const w = (img as HTMLImageElement).naturalWidth || 0
                  const h = (img as HTMLImageElement).naturalHeight || 0
                  if (w > 0 && h > 0) setImgDims({ w, h })
                }}
              />
            ) : (
              <div className="w-full h-full" />
            )}
            {/* Overlay loader if generating or no active image */}
            {(!activeImage || isGenerating) && (
              <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center gap-3">
                <span className="inline-block w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span className="text-white/80 text-sm">Generating preview...</span>
              </div>
            )}
            {/* Small badge if image exists but still generating more */}
            {activeImage && isGenerating && (
              <div className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-full bg-white/10 border border-white/20 text-white/80">Generating…</div>
            )}
          </div>

          {/* Variant output skeletons while generating */}
          {(isGenerating || allImages.length === 0) && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="h-16 rounded-lg bg-white/[0.06] border border-white/10 animate-pulse" />
              <div className="h-16 rounded-lg bg-white/[0.06] border border-white/10 animate-pulse" />
              <div className="h-16 rounded-lg bg-white/[0.06] border border-white/10 animate-pulse" />
            </div>
          )}
        </div>

        {/* Thumbnails (mobile) */}
        {thumbs.length > 0 && (
          <div className="md:hidden mt-3 flex gap-2 overflow-x-auto">
            {thumbs.map((t) => {
              if (!t.image_url) return null
              const isActive = (selectedItem?.image_url || activeImage) === t.image_url
              return (
                <button
                  key={`${normUrl(t.image_url)}|${normPlacement(t.placement).key}`}
                  onClick={() => { setSelectedImageUrl(t.image_url) }}
                  className={`relative flex-none w-16 h-16 rounded-lg border overflow-hidden ${isActive ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]' : 'border-white/10 hover:border-white/20'}`}
                  style={{ backgroundColor: isPng(t.image_url) ? (selectedColorHex || t.background_color || 'transparent') : 'transparent' }}
                  title={normPlacement(t.placement).label}
                >
                  <Image src={t.image_url} alt="thumb" fill sizes="64px" className="object-cover" />
                </button>
              )
            })}
          </div>
        )}

        {/* Placement */}
        {plImages.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-white/60 mb-2">Placement</div>
            <div className="flex flex-wrap gap-2">
              {plImages.map((it) => {
                const { key, label } = normPlacement(it.placement)
                const active = placement === key
                // Debug key list once
                if (typeof window !== 'undefined') {
                  console.debug('[placement]', { keys: plImages.map((x) => normPlacement(x.placement).key) })
                }
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedImageUrl(null); setPlacement(key) }}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${active ? 'border-amber-400/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.04]'}`}
                  >{label}</button>
                )
              })}
            </div>
          </div>
        )}

        {/* Background assist removed per UX feedback */}

        {/* Colors */}
        {colors.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-white/60 mb-2">Color</div>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => {
                const isActive = selectedColor === c.name
                const bg = c.code && /^#?[0-9a-fA-F]{3,8}$/.test(c.code) ? (c.code.startsWith('#') ? c.code : `#${c.code}`) : undefined
                return (
                  <button
                    key={c.name}
                    onClick={() => { setSelectedColor(c.name); setSelectedImageUrl(null) }}
                    title={c.name}
                    className={`relative w-8 h-8 rounded-full border ${isActive ? 'border-amber-400/60 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]' : 'border-white/20'} overflow-hidden`}
                    aria-label={c.name}
                  >
                    <span
                      className="absolute inset-0"
                      style={{ background: bg || 'linear-gradient(135deg, rgba(255,255,255,.16), rgba(0,0,0,.16))' }}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Sizes */}
        {sizes.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-white/60 mb-2">Size</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSize(s)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${selectedSize===s ? 'border-amber-400/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.04]'}`}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-6 text-white/70 text-sm leading-relaxed whitespace-pre-line">{product.description}</div>
        )}
      </div>

      {/* Right: style + prompt */}
      <div>
        {!isGenerating ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4">
            <div className="text-sm text-white/60 mb-2">Style</div>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStyle(s)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${selectedStyle===s ? 'border-amber-400/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.04]'}`}
                >{s}</button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-white/60 mb-2">Prompt</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Crimson and gold phoenix in minimalist line art, centered composition"
              rows={6}
              className="w-full resize-none bg-transparent outline-none placeholder:text-white/40 text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-shimmer"
            >
              Generate
            </button>
            <div className="text-xs text-white/50 self-center">
              Color: <span className="text-white/80">{selectedColor || '-'}</span> • Size: <span className="text-white/80">{selectedSize || '-'}</span>
            </div>
          </div>
        </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 animate-pulse">
            <div className="h-4 w-24 bg-white/10 rounded mb-4" />
            <div className="h-8 w-full bg-white/10 rounded mb-3" />
            <div className="h-8 w-full bg-white/10 rounded mb-3" />
            <div className="h-24 w-full bg-white/10 rounded" />
            <div className="mt-4 text-sm text-white/70">Generating your design… Inputs will return shortly.</div>
          </div>
        )}
      </div>
    </div>
  )
}
