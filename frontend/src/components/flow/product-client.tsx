'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getProductBySlug } from '@/lib/data'
import { useFlow } from '@/components/flow-provider'
import BackHomeBar from '@/components/back-home-bar'

export default function ProductClient({ slug }: { slug: string }) {
  const router = useRouter()
  const { setProduct, setVariant, setStyle, productSlug, variant, prompt, shortcutMode, isGenerating } = useFlow()
  const product = getProductBySlug(slug)

  const [selected, setSelected] = useState<string>(variant || '')

  useEffect(() => {
    if (product && productSlug !== product.slug) {
      setProduct(product.slug, product.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

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

  const handleContinue = () => {
    if (!selected) return
    setVariant(selected)
    if (shortcutMode) {
      // Skip style in shortcut mode, go straight to prompt/generating view
      setStyle('Standard')
      router.push(`/product/${product.slug}/prompt`)
    } else {
      router.push(`/product/${product.slug}/style`)
    }
  }

  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
      <BackHomeBar />
      {shortcutMode && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-200">
          <div className="text-sm">
            Generating ideas for: <span className="font-medium text-amber-100">{prompt || 'your prompt'}</span>. Select a variant to guide the outputs.
          </div>
        </div>
      )}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{product.name}</h1>
          <p className="text-white/60 mt-1">Choose a variant to get started.</p>
        </div>
        <Link href="/categories" className="text-white/70 hover:text-white underline">
          Back to categories
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {product.variants.map((v) => (
          <button
            key={v}
            onClick={() => setSelected(v)}
            className={
              `group relative rounded-xl border px-4 py-6 text-left transition-all ` +
              (selected === v
                ? 'border-amber-400/40 bg-white/[0.06] shadow-[0_0_30px_-10px_rgba(251,191,36,0.6)]'
                : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]')
            }
          >
            <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity btn-shimmer" />
            <div className="font-medium">{v}</div>
            <div className="text-xs text-white/60 mt-1">High quality • Fast fulfillment</div>
          </button>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-shimmer"
        >
          {shortcutMode ? 'Use this variant' : 'Continue'}
        </button>
        <Link
          href="/categories"
          className="rounded-lg px-5 py-2.5 border border-white/15 text-white/80 hover:text-white hover:border-white/30"
        >
          Cancel
        </Link>
      </div>
    </main>
  )
}

