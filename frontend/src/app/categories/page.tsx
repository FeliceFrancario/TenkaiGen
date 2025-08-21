"use client"

import Link from 'next/link'
import { PRODUCTS } from '@/lib/data'
import BackHomeBar from '@/components/back-home-bar'
import { useFlow } from '@/components/flow-provider'

export default function CategoriesPage() {
  const { shortcutMode, isGenerating, prompt } = useFlow()
  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
      <BackHomeBar />
      {(shortcutMode || isGenerating) && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-200">
          <div className="text-sm">
            Generating designs for: <span className="font-medium text-amber-100">{(prompt || '').slice(0,120) || 'your prompt'}</span>. Pick a category to guide the results while you wait.
          </div>
        </div>
      )}
      <h1 className="text-3xl font-semibold mb-6">Categories</h1>
      <p className="text-white/60 mb-8">Pick a category to start the product → style → prompt flow.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PRODUCTS.map((p) => (
          <Link
            key={p.slug}
            href={`/product/${p.slug}`}
            className="group relative rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center transition-colors hover:border-white/20 hover:bg-white/[0.06]"
          >
            <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity btn-shimmer" />
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-white/60 mt-1">{p.variants.length} variants</div>
          </Link>
        ))}
      </div>
    </main>
  )
}
