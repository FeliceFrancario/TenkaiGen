'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { STYLES } from '@/lib/styles'

export type CatalogProduct = {
  id: number
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
    if (set.size) return Array.from(set)
    return product.sizes || []
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

  const activeImage = activeVariant?.image || product.image || undefined

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
        <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/[0.06]">
          {activeImage ? (
            <Image src={activeImage} alt={product.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-contain" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>

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
                    onClick={() => setSelectedColor(c.name)}
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
      </div>
    </div>
  )
}
