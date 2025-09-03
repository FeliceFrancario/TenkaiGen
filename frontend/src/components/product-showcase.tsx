'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// Fallback items so the homepage never renders empty if the store API returns no products
const FALLBACKS: Array<{ id: number; name: string; thumbnail: string | null; min_price: number | null; currency: string | null }> = [
  { id: -1, name: 'Crimson Sakura Hoodie', thumbnail: null, min_price: 59, currency: 'USD' },
  { id: -2, name: 'Gold Foil Tee', thumbnail: null, min_price: 32, currency: 'USD' },
  { id: -3, name: 'Silver Lineart Tote', thumbnail: null, min_price: 28, currency: 'USD' },
  { id: -4, name: 'Cyberpunk Koi Tee', thumbnail: null, min_price: 35, currency: 'USD' },
  { id: -5, name: 'Minimalist Fox Tee', thumbnail: null, min_price: 29, currency: 'USD' },
]

export function ProductShowcase() {
  const router = useRouter()
  const [items, setItems] = useState<Array<{ id: number; name: string; thumbnail: string | null; min_price: number | null; currency: string | null }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/printful/store-products?limit=12', { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load products')
        const data = await res.json()
        if (mounted) setItems(Array.isArray(data?.result) ? data.result : [])
      } catch (e) {
        console.error('[ProductShowcase] fetch error', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const fmt = (price: number | null, currency: string | null) => {
    if (price == null) return ''
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(price)
    } catch {
      return `$${Math.round(price)}`
    }
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-tenkai-dark relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-white">High-quality apparel</h2>
            <p className="text-white/50 text-sm">Our community favorites. Click to browse all categories.</p>
          </div>
          <button onClick={() => router.push('/catalog')} className="hidden sm:inline-flex btn-shimmer px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition">Explore all</button>
        </div>

        {/* edge gradient fades */}
        <div className="pointer-events-none absolute left-0 top-[160px] bottom-10 w-12 bg-gradient-to-r from-tenkai-dark to-transparent" />
        <div className="pointer-events-none absolute right-0 top-[160px] bottom-10 w-12 bg-gradient-to-l from-tenkai-dark to-transparent" />

        <div className="relative overflow-x-auto no-scrollbar snap-x snap-mandatory">
          <div className="flex gap-5 min-w-max px-1">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="snap-start w-56 shrink-0 rounded-2xl bg-white/[0.03] border border-white/10 animate-pulse">
                    <div className="h-40 rounded-t-2xl bg-white/[0.06]" />
                    <div className="p-4">
                      <div className="h-4 w-32 bg-white/[0.08] rounded mb-2" />
                      <div className="h-4 w-16 bg-white/[0.08] rounded" />
                    </div>
                  </div>
                ))
              : (items.length ? items : FALLBACKS).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => router.push('/catalog')}
                    className="snap-start w-56 shrink-0 cursor-pointer rounded-2xl bg-white/[0.03] border border-white/10 hover:border-tenkai-gold/40 hover:bg-white/[0.06] transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_14px_40px_rgba(212,175,55,0.18)] hover:-translate-y-0.5"
                  >
                    <div className="h-40 rounded-t-2xl bg-gradient-to-br from-tenkai-silver/20 via-white/10 to-transparent flex items-center justify-center overflow-hidden">
                      {p.thumbnail ? (
                        <Image
                          src={p.thumbnail}
                          alt={p.name}
                          width={224}
                          height={160}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-4xl">👕</div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-white text-sm font-medium truncate" title={p.name}>{p.name}</h3>
                        {p.min_price != null && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gradient-to-r from-tenkai-gold/20 to-red-500/20 text-white/80 border border-white/10">
                            {fmt(p.min_price, p.currency)}
                          </span>
                        )}
                      </div>
                      <div className="text-tenkai-gold font-semibold">{p.min_price != null ? 'From ' + fmt(p.min_price, p.currency) : 'View'}</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  )
}
