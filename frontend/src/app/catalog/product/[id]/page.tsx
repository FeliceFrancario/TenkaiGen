import { headers } from 'next/headers'
import BackHomeBar from '@/components/back-home-bar'
import CatalogProductDetail from '@/components/catalog-product-detail'

export const dynamic = 'force-dynamic'

async function absoluteUrl(path: string) {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}${path}`
}

export default async function CatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pid = Number(id)
  if (!pid || Number.isNaN(pid)) {
    return (
      <main className="min-h-[60vh] px-6 py-16 max-w-6xl mx-auto text-white">
        <BackHomeBar />
        <h1 className="text-2xl font-semibold mb-2">Invalid product</h1>
        <p className="text-white/60">The product ID "{id}" is not valid.</p>
      </main>
    )
  }

  const res = await fetch(await absoluteUrl(`/api/printful/product?product_id=${pid}`), { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return (
      <main className="min-h-[60vh] px-6 py-16 max-w-6xl mx-auto text-white">
        <BackHomeBar />
        <h1 className="text-2xl font-semibold mb-2">Failed to load product</h1>
        <p className="text-white/60">{err?.error || 'Unknown error'}</p>
      </main>
    )
  }
  const data = await res.json()
  const product = data?.result

  if (!product) {
    return (
      <main className="min-h-[60vh] px-6 py-16 max-w-6xl mx-auto text-white">
        <BackHomeBar />
        <h1 className="text-2xl font-semibold mb-2">Product not found</h1>
        <p className="text-white/60">We couldn't find details for this product.</p>
      </main>
    )
  }

  return (
    <main className="min-h-[60vh] px-6 py-10 max-w-6xl mx-auto text-white">
      <BackHomeBar />
      <CatalogProductDetail product={product} />
    </main>
  )
}
