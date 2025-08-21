"use client"

import Link from 'next/link'
import { PRODUCTS } from '@/lib/data'
import BackHomeBar from '@/components/back-home-bar'
import { useFlow } from '@/components/flow-provider'

type Group = {
  title: string
  description: string
  slugs: string[]
}

const GROUPS: Group[] = [
  { title: "Men's Clothing", description: 'Popular apparel picks', slugs: ['t-shirts', 'hoodies', 'hats'] },
  { title: "Women's Clothing", description: 'On-trend fits', slugs: ['t-shirts', 'hoodies', 'hats'] },
  { title: 'Kids', description: 'Comfy and durable', slugs: ['t-shirts', 'hoodies'] },
  { title: 'Accessories', description: 'Daily carry & more', slugs: ['totes', 'phone-cases', 'stickers', 'hats'] },
  { title: 'Home & Living', description: 'Mugs, posters, and decor', slugs: ['mugs', 'posters'] },
]

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
      <div className="space-y-10">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <div className="mb-3">
              <h2 className="text-xl font-semibold">{g.title}</h2>
              <p className="text-white/60 text-sm">{g.description}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {g.slugs.map((slug) => {
                const p = PRODUCTS.find((x) => x.slug === slug)
                if (!p) return null
                return (
                  <Link
                    key={p.slug}
                    href={`/product/${p.slug}?from=categories`}
                    className="group relative rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity btn-shimmer" />
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-white/60 mt-1">{p.variants.length} variants</div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
