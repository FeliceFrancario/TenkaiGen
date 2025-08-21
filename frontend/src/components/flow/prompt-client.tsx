'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getProductBySlug } from '@/lib/data'
import { useFlow } from '@/components/flow-provider'
import BackHomeBar from '@/components/back-home-bar'

export default function PromptClient({ slug }: { slug: string }) {
  const router = useRouter()
  const { productName, variant, style, prompt, setPrompt, setStyle, isGenerating, setGenerating, shortcutMode } = useFlow()
  const product = getProductBySlug(slug)
  const [value, setValue] = useState<string>(prompt || '')

  // Guards: require variant and style unless shortcutMode
  useEffect(() => {
    if (!product) return
    if (shortcutMode) {
      if (!variant) {
        router.replace(`/product/${product.slug}`)
        return
      }
      if (!style) setStyle('Standard')
      return
    }
    if (!variant) {
      router.replace(`/product/${product.slug}`)
      return
    }
    if (!style) {
      router.replace(`/product/${product.slug}/style`)
      return
    }
  }, [slug, shortcutMode, variant, style])

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

  const handleGenerate = () => {
    const p = value.trim()
    if (!p) return
    setPrompt(p)
    if (!isGenerating) setGenerating(true)
  }

  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-3xl mx-auto text-white">
      <BackHomeBar />
      {(shortcutMode || isGenerating) && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-200">
          <div className="text-sm">
            Generating designs for: <span className="font-medium text-amber-100">{(value || prompt || '').slice(0, 120) || 'your prompt'}</span>
          </div>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{productName || product.name} • Prompt</h1>
        <p className="text-white/60 mt-1">Describe what you want to create. Keep it concise and visual.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 text-sm text-white/70">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="text-white/50">Variant</div>
          <div className="text-white">{variant || '—'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <div className="text-white/50">Style</div>
          <div className="text-white">{style || '—'}</div>
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

