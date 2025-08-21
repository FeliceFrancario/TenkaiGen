'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getProductBySlug } from '@/lib/data'
import { useFlow } from '@/components/flow-provider'
import BackHomeBar from '@/components/back-home-bar'
import { STYLES } from '@/lib/styles'

export default function StyleClient({ slug }: { slug: string }) {
  const router = useRouter()
  const { productName, setStyle, variant, style } = useFlow()
  const product = getProductBySlug(slug)

  const [selected, setSelected] = useState<string>(style || '')

  // Guard: require variant before style.
  useEffect(() => {
    if (!product) return
    if (!variant) {
      router.replace(`/product/${product.slug}`)
    }
  }, [slug, variant])

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
    setStyle(selected)
    router.push(`/product/${product.slug}/prompt`)
  }

  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
      <BackHomeBar />
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{productName || product.name} • Style</h1>
          <p className="text-white/60 mt-1">Pick a visual direction for your design.</p>
        </div>
        <Link href={`/product/${product.slug}`} className="text-white/70 hover:text-white underline">
          Back to variants
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {STYLES.map((s) => (
          <button
            key={s}
            onClick={() => setSelected(s)}
            className={
              `group relative rounded-xl border px-4 py-6 text-left transition-all ` +
              (selected === s
                ? 'border-amber-400/40 bg-white/[0.06] shadow-[0_0_30px_-10px_rgba(251,191,36,0.6)]'
                : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]')
            }
          >
            <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity btn-shimmer" />
            <div className="font-medium">{s}</div>
            <div className="text-xs text-white/60 mt-1">On-trend • High-impact</div>
          </button>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-shimmer"
        >
          Continue
        </button>
        <Link
          href={`/product/${product.slug}`}
          className="rounded-lg px-5 py-2.5 border border-white/15 text-white/80 hover:text-white hover:border-white/30"
        >
          Back
        </Link>
      </div>
    </main>
  )
}
