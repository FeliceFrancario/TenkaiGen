'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ProductGridSkeleton } from './product-skeleton'

type PfProduct = { 
  id: number; 
  title: string; 
  main_category_id: number; 
  thumbnail: string | null; 
  _ships?: boolean; 
  price?: string | null; 
  currency?: string 
}

interface ProductGridProps {
  products: PfProduct[]
  isLoading?: boolean
}

export function ProductGrid({ products, isLoading = false }: ProductGridProps) {
  if (isLoading) {
    return <ProductGridSkeleton />
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {products.map((p) => (
        <Link
          key={p.id}
          href={`/catalog/product/${p.id}`}
          className="group rounded-2xl overflow-hidden border border-amber-400/25 bg-white/[0.035] transition hover:border-amber-400/60 hover:shadow-[0_18px_50px_rgba(244,63,94,0.22),0_10px_24px_rgba(212,175,55,0.18)] hover:translate-y-[-2px] active:translate-y-0"
        >
          <div className="relative aspect-square bg-white/5">
            {p.thumbnail ? (
              <Image src={p.thumbnail} alt={p.title} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
            ) : null}
            
            {/* Shipping availability badge */}
            {p._ships === false && (
              <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/95 text-white text-[10px] font-bold shadow-lg border border-rose-400/50">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Not available in your region
              </div>
            )}
            
            {/* Price badge */}
            {p.price && (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/95 to-yellow-500/95 text-black text-[11px] font-bold shadow-lg border border-amber-400/50 backdrop-blur-sm">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                {p.currency} {p.price}
              </div>
            )}
            
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(244,63,94,0.16),transparent_55%)]" />
          </div>
          <div className="p-4 text-center">
            <div className="font-semibold text-sm text-amber-200 line-clamp-2">{p.title}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
