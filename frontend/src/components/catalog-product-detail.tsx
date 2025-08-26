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
  type PlImage = { placement: string; image_url: string; background_color?: string | null; background_image?: string | null }
  const [plImages, setPlImages] = useState<PlImage[]>([])
  const [placement, setPlacement] = useState<string>('front')
  type ScoredImage = PlImage & { _score: number; _key: string }
  const [allImages, setAllImages] = useState<ScoredImage[]>([])
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

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

  // Helper: color matching across varying metadata
  const colorMatches = (img: PlImage, selName?: string, selHex?: string | null) => {
    const bgHex = normalizeHex(img.background_color || null)
    if (selHex && bgHex && selHex === bgHex) return true
    if (!selName) return false
    const synMap: Record<string, string[]> = {
      black: ['black', 'blk'],
      white: ['white', 'wht'],
      red: ['red', 'scarlet', 'cardinal', 'maroon'],
      blue: ['blue', 'royal', 'cyan'],
      navy: ['navy', 'navyblue'],
      green: ['green', 'forest', 'olive'],
      gray: ['gray', 'grey', 'charcoal', 'athleticheather', 'heathergray', 'darkheather'],
      pink: ['pink', 'rose'],
      purple: ['purple', 'violet'],
      orange: ['orange'],
      yellow: ['yellow', 'gold'],
      brown: ['brown', 'chocolate'],
      cream: ['cream', 'bone', 'oat', 'oatmeal', 'ivory'],
    }
    const sanitize = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
    const base = sanitize(selName)
    // Expand simple base->family mapping
    let family: string[] = []
    for (const [k, arr] of Object.entries(synMap)) {
      if (base.includes(k)) { family = arr; break }
    }
    const urlSan = sanitize(normUrl(img.image_url || ''))
    // If any conflicting color tokens from other families are present, reject to avoid false positives (e.g., 'black' in URL)
    const allFamilies = Object.values(synMap)
    const flatTokens = allFamilies.flat()
    const selectedSet = new Set([base, ...family].filter(Boolean))
    const otherTokens = flatTokens.filter((t) => !selectedSet.has(t))
    const conflict = otherTokens.some((tok) => tok && urlSan.includes(tok))
    if (conflict) return false
    // match base or any synonym token
    if (base && urlSan.includes(base)) return true
    for (const tok of family) { if (urlSan.includes(tok)) return true }
    return false
  }

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
    const fromVariant = normalizeHex(activeVariant?.color_code || null)
    if (fromVariant) return fromVariant
    const match = colors.find((c) => c.name === selectedColor)
    return normalizeHex(match?.code || null)
  }, [activeVariant?.color_code, colors, selectedColor])

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
          if (womensSelected) {
            if (/(onwoman|womens|women\b)/i.test(url)) s += 6
            if (/(onman\b|\bmen\b)/i.test(url)) s -= 3
          }
          if (mensSelected) {
            if (/(onman\b|\bmen\b)/i.test(url)) s += 6
            if (/(onwoman|womens|women\b)/i.test(url)) s -= 3
          }
          if (unisexSelected) {
            if (/(ghost|flat)/i.test(url)) s += 3
            if (/onman\b/i.test(url)) s -= 1
          }
          return { ...it, _score: s, _key: norm }
        })
        // Save all scored images for gallery (stable sort by score desc), ensure non-empty src
        const allSorted = scored
          .filter((it) => !!(it.image_url && String(it.image_url).trim().length > 0))
          // Stronger dedupe on base URL (ignore query params)
          .reduce((acc: ScoredImage[], cur) => {
            const key = normUrl(cur.image_url)
            if (!acc.find((x) => normUrl(x.image_url) === key)) acc.push(cur)
            return acc
          }, [])
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
    // Filter by placement first
    let matches = allImages.filter((i) => normPlacement(i.placement).key === placement)
    // Gender hard filter to remove opposite models
    if (womensSelected) matches = matches.filter((i) => !/(onman\b|\bmen\b)/i.test(i.image_url))
    if (mensSelected) matches = matches.filter((i) => !/(onwoman|womens|women\b)/i.test(i.image_url))
    // Color: always enforce selected color (hex or name heuristics). If no matches, return null -> fall back to variant image
    if (selectedColor) {
      const byColor = matches.filter((i) => colorMatches(i, selectedColor, selectedColorHex))
      if (!byColor.length) return null
      matches = byColor
    }
    // Sort and pick top
    matches.sort((a, b) => {
      const r = styleRank(a.image_url) - styleRank(b.image_url)
      if (r !== 0) return r
      return b._score - a._score
    })
    return matches[0] || null
  }, [allImages, placement, selectedImageUrl, selectedColorHex, selectedColor, womensSelected, mensSelected])

  // Prefer mockup selection; if none (e.g., color strict filter), fall back to variant's colored image, then product image
  const activeImage = selectedItem?.image_url || activeVariant?.image || product.image || placementImage?.image_url || undefined

  const thumbs = useMemo(() => {
    let arr = allImages
    // Filter by placement to keep the stack focused
    arr = arr.filter((it) => normPlacement(it.placement).key === placement)
    // Gender-based filtering
    if (womensSelected) arr = arr.filter((it) => !/(onman\b|\bmen\b)/i.test(it.image_url))
    if (mensSelected) arr = arr.filter((it) => !/(onwoman|womens|women\b)/i.test(it.image_url))
    // Color filtering (strict): require selected color via hex or name heuristics
    if (selectedColor) {
      const withColor = arr.filter((i) => colorMatches(i, selectedColor, selectedColorHex))
      arr = withColor
    }
    // Filter invalid src
    arr = arr.filter((it) => !!(it.image_url && it.image_url.trim().length > 0))
    // Dedupe by image_url
    const seen = new Set<string>()
    const uniq = arr.filter((it) => {
      const key = normUrl(it.image_url)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    // Sort model first, then ghost, then flat, then score
    const sorted = uniq.sort((a, b) => {
      const r = styleRank(a.image_url) - styleRank(b.image_url)
      if (r !== 0) return r
      return b._score - a._score
    })
    return sorted.slice(0, 8)
  }, [allImages, placement, womensSelected, mensSelected, selectedColorHex, selectedColor])

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
                  key={t.image_url}
                  onClick={() => { setSelectedImageUrl(t.image_url); setPlacement(normPlacement(t.placement).key) }}
                  className={`relative w-16 h-16 rounded-lg border overflow-hidden ${isActive ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]' : 'border-white/10 hover:border-white/20'} bg-white/[0.03]`}
                  title={normPlacement(t.placement).label}
                >
                  <Image src={t.image_url} alt="thumb" fill sizes="64px" className="object-cover" />
                </button>
              )
            })}
          </div>

          {/* Main image */}
          <div
            className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10"
            style={{
              // Do not tint canvas with garment color; only show an ambient background image if provided
              backgroundColor: 'rgba(255,255,255,0.06)',
              backgroundImage: (selectedItem?.background_image || placementImage?.background_image) ? `url(${selectedItem?.background_image || placementImage?.background_image})` : undefined,
              backgroundSize: (selectedItem?.background_image || placementImage?.background_image) ? 'cover' : undefined,
              backgroundPosition: (selectedItem?.background_image || placementImage?.background_image) ? 'center' : undefined,
            }}
          >
            {activeImage ? (
              <Image src={activeImage} alt={product.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain" />
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
                  key={t.image_url}
                  onClick={() => { setSelectedImageUrl(t.image_url); setPlacement(normPlacement(t.placement).key) }}
                  className={`relative flex-none w-16 h-16 rounded-lg border overflow-hidden ${isActive ? 'border-amber-400/60 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]' : 'border-white/10 hover:border-white/20'} bg-white/[0.03]`}
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
