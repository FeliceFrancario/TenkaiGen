import { headers } from 'next/headers'
import Link from 'next/link'
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

  // Fetch categories to build breadcrumbs from product.main_category_id
  type PfCategory = { id: number; title: string; image_url: string | null; parent_id: number }
  let ancestors: PfCategory[] = []
  try {
    const cres = await fetch(await absoluteUrl(`/api/printful/categories`), { cache: 'no-store' })
    if (cres.ok) {
      const cdata = await cres.json()
      const cats: PfCategory[] = (cdata?.result?.categories || []) as PfCategory[]
      const byId = new Map<number, PfCategory>()
      for (const c of cats) byId.set(c.id, c)
      let cur: PfCategory | undefined = byId.get(product.main_category_id as number)
      while (cur) {
        ancestors.unshift(cur)
        cur = byId.get(cur.parent_id)
      }
    }
  } catch {}

  return (
    <main className="min-h-[60vh] px-6 py-10 max-w-6xl mx-auto text-white">
      <BackHomeBar />
      {ancestors.length > 0 && (
        <div className="mb-4 text-xs text-white/60">
          {ancestors.map((a, i) => (
            <span key={a.id} className="[&:not(:last-child)]:after:content-['/'] [&:not(:last-child)]:after:mx-2">
              <Link href={`/catalog/${a.id}`} className="hover:text-white/80">
                {a.title}
              </Link>
            </span>
          ))}
        </div>
      )}
      <CatalogProductDetail product={product} />
    </main>
  )
}
