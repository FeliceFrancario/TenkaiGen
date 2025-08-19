'use client'

import { useRouter } from 'next/navigation'

export function ProductShowcase() {
  const router = useRouter()
  const products = [
    { name: 'Crimson Sakura Hoodie', price: '$59', tag: 'Bestseller' },
    { name: 'Gold Foil Tee', price: '$32', tag: 'Trending' },
    { name: 'Silver Lineart Tote', price: '$28', tag: 'New' },
    { name: 'Cyberpunk Koi Tee', price: '$35', tag: 'Hot' },
    { name: 'Minimalist Fox Tee', price: '$29', tag: 'Classic' },
  ]

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-tenkai-dark relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-white">High-quality apparel</h2>
            <p className="text-white/50 text-sm">Our community favorites. Click to browse all categories.</p>
          </div>
          <button onClick={() => router.push('/categories')} className="btn-shimmer px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition">Explore all</button>
        </div>

        {/* edge gradient fades */}
        <div className="pointer-events-none absolute left-0 top-[160px] bottom-10 w-12 bg-gradient-to-r from-tenkai-dark to-transparent" />
        <div className="pointer-events-none absolute right-0 top-[160px] bottom-10 w-12 bg-gradient-to-l from-tenkai-dark to-transparent" />

        <div className="relative overflow-x-auto no-scrollbar snap-x snap-mandatory">
          <div className="flex gap-5 min-w-max px-1">
            {products.map((p, i) => (
              <div
                key={i}
                onClick={() => router.push('/categories')}
                className="snap-start w-56 shrink-0 cursor-pointer rounded-2xl bg-white/[0.03] border border-white/10 hover:border-tenkai-gold/40 hover:bg-white/[0.06] transition-all shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_14px_40px_rgba(212,175,55,0.18)] hover:-translate-y-0.5"
              >
                <div className="h-40 rounded-t-2xl bg-gradient-to-br from-tenkai-silver/20 via-white/10 to-transparent flex items-center justify-center text-5xl">
                  👕
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-white text-sm font-medium truncate">{p.name}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-tenkai-gold/20 to-red-500/20 text-white/80 border border-white/10">{p.tag}</span>
                  </div>
                  <div className="text-tenkai-gold font-semibold">{p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
