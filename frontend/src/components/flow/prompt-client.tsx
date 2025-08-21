'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getProductBySlug } from '@/lib/data'
import { useFlow } from '@/components/flow-provider'
import BackHomeBar from '@/components/back-home-bar'
import { STYLES } from '@/lib/styles'

export default function PromptClient({ slug }: { slug: string }) {
  const router = useRouter()
  const { productSlug, productName, variant, style, prompt, expandedPrompt, franchise, color, size, printArea, setPrompt, setStyle, setVariant, isGenerating, setGenerating, shortcutMode, setExpandedPrompt, setFranchise } = useFlow()
  const product = getProductBySlug(slug)
  const [value, setValue] = useState<string>(prompt || '')
  const [showVariantPicker, setShowVariantPicker] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [detectingStyle, setDetectingStyle] = useState(false)
  const [jobQueued, setJobQueued] = useState(false)

  // Guards: require variant; if style missing, allow brief detection window then default to Standard
  useEffect(() => {
    if (!product) return
    if (!variant) {
      router.replace(`/product/${product.slug}`)
      return
    }
    if (!style) {
      setDetectingStyle(true)
      const t = setTimeout(() => {
        if (!style) setStyle('Standard')
        setDetectingStyle(false)
      }, 1200)
      return () => clearTimeout(t)
    } else {
      setDetectingStyle(false)
    }
  }, [slug, variant, style])

  // Auto-queue first generation in shortcut flow (or when isGenerating is true)
  useEffect(() => {
    if (!product) return
    if (!variant) return
    if (!isGenerating) return
    if (jobQueued) return
    (async () => {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productSlug: productSlug || product.slug,
            productName: productName || product.name,
            variant,
            style: style || 'Standard',
            color,
            size,
            printArea,
            prompt: value || prompt || '',
            expandedPrompt,
            franchise,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          console.debug('[prompt] queued generation', data)
          setJobQueued(true)
        }
      } catch (e) {
        console.error('[prompt] queue generation error', e)
      }
    })()
  }, [product, variant, isGenerating])

  if (!product) {
    return (
      <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
        <BackHomeBar />
        <h1 className="text-2xl font-semibold mb-4">Product not found</h1>
        <Link href="/categories" className="text-white/70 hover:text-white underline">
          Back to categories
        </Link>
      </main>
    )
  }

  const handleGenerate = async () => {
    const p = value.trim()
    if (!p) return
    setPrompt(p)
    if (!isGenerating) setGenerating(true)
    try {
      // Clear stale franchise before parsing anew
      setFranchise(undefined)
      const res = await fetch('/api/parse-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      })
      if (res.ok) {
        const data: { expandedPrompt?: string; franchise?: string | null; suggestedStyle?: string | null } = await res.json()
        if (data.expandedPrompt) setExpandedPrompt(data.expandedPrompt)
        if (data.franchise) setFranchise(data.franchise)
        else setFranchise(undefined)
        // Respect manual selection; only set style if none chosen
        if (!style && data.suggestedStyle) setStyle(data.suggestedStyle)
      }
      // TODO: Kick off image generation with current selections and expandedPrompt
    } catch (e) {
      console.error('[prompt] parse-prompt error', e)
    }
  }

  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-3xl mx-auto text-white">
      <BackHomeBar />
      {(shortcutMode || isGenerating) && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-200">
          <div className="text-sm">
            Generating designs for: <span className="font-medium text-amber-100">{(value || prompt || '').slice(0, 120) || 'your prompt'}</span>
            {isGenerating && !jobQueued && <span className="ml-2 text-amber-300">(setting up…)</span>}
          </div>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{productName || product.name} • Prompt</h1>
        <p className="text-white/60 mt-1">Describe what you want to create. Keep it concise and visual.</p>
      </div>

      {/* Collapsible controls for variant and style */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/70">
        <div className="rounded-lg border border-white/10 bg-white/[0.04]">
          <button
            onClick={() => setShowVariantPicker((s) => !s)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/[0.06] rounded-lg"
          >
            <div>
              <div className="text-white/50">Variant</div>
              <div className="text-white">{variant || 'Select variant'}</div>
            </div>
            <span className={`transition-transform ${showVariantPicker ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {showVariantPicker && (
            <div className="p-3 pt-0">
              <div className="flex flex-wrap gap-2">
                {(product.variants || []).map((v) => (
                  <button
                    key={v}
                    onClick={() => { setVariant(v); setShowVariantPicker(false) }}
                    className={`px-3 py-1.5 rounded-lg border ${variant===v ? 'border-amber-400/40 bg-white/[0.08] text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.04] text-white/80'}`}
                  >{v}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04]">
          <button
            onClick={() => setShowStylePicker((s) => !s)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/[0.06] rounded-lg"
          >
            <div>
              <div className="text-white/50 flex items-center gap-2">Style {detectingStyle && !style && <span className="text-amber-300 text-xs">Detecting…</span>}</div>
              <div className="text-white">{style || 'Select style'}</div>
            </div>
            <span className={`transition-transform ${showStylePicker ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {showStylePicker && (
            <div className="p-3 pt-0">
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStyle(s); setShowStylePicker(false) }}
                    className={`px-3 py-1.5 rounded-lg border ${style===s ? 'border-amber-400/40 bg-white/[0.08] text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.04] text-white/80'}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g., Crimson and gold phoenix in minimalist line art, centered composition"
          rows={5}
          className="w-full resize-none bg-transparent outline-none placeholder:text-white/40 text-white"
        />
        <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 hover:opacity-100 transition-opacity btn-shimmer" />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={!value.trim()}
          className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-shimmer"
        >
          {isGenerating ? 'Generating…' : 'Generate'}
        </button>
        {shortcutMode ? (
          <Link
            href={`/product/${product.slug}`}
            className="rounded-lg px-5 py-2.5 border border-white/15 text-white/80 hover:text-white hover:border-white/30"
          >
            Back
          </Link>
        ) : (
          <Link
            href={`/product/${product.slug}/style`}
            className="rounded-lg px-5 py-2.5 border border-white/15 text-white/80 hover:text-white hover:border-white/30"
          >
            Back
          </Link>
        )}
      </div>

      {isGenerating && (
        <div className="mt-8">
          <div className="text-white/70 text-sm mb-3">Preview variants will appear here as they complete:</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg border border-white/10 bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

