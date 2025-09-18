import Image from 'next/image'
import Link from 'next/link'
import BackHomeBar from '@/components/back-home-bar'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

async function absoluteUrl(path: string) {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}${path}`
}

type PfCategory = { id: number; title: string; image_url: string | null; parent_id: number }
type PfProduct = { id: number; title: string; main_category_id: number; thumbnail: string | null }

async function getCategories(): Promise<PfCategory[]> {
  const res = await fetch(await absoluteUrl(`/api/printful/categories`), { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.result?.categories || []) as PfCategory[]
}

async function getProducts(categoryId: number): Promise<PfProduct[]> {
  const res = await fetch(await absoluteUrl(`/api/printful/products?category_id=${categoryId}&limit=24`), { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.result || []) as PfProduct[]
}

export default async function CatalogCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id || Number.isNaN(id)) {
    return (
      <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
        <BackHomeBar />
        <h1 className="text-2xl font-semibold">Invalid category</h1>
      </main>
    )
  }

  const cats = await getCategories()
  const byId = new Map<number, PfCategory>()
  for (const c of cats) byId.set(c.id, c)
  const cat = byId.get(id) || null
  const children = cats.filter((c) => c.parent_id === id)
  const ancestors: PfCategory[] = []
  let cur = cat || null
  while (cur) {
    ancestors.unshift(cur)
    cur = byId.get(cur.parent_id) || null
  }
  const products = children.length === 0 ? await getProducts(id) : []

  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-6xl mx-auto text-white">
      <BackHomeBar />
      <div className="mb-6">
        <div className="text-xs text-white/60 mb-2">
          {ancestors.map((a, i) => (
            <span key={a.id} className="[&:not(:last-child)]:after:content-['/'] [&:not(:last-child)]:after:mx-2">
              {a.title}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-semibold text-amber-200 drop-shadow">{cat?.title || 'Category'}</h1>
        {cat?.image_url ? (
          <div className="mt-3 relative w-full max-w-3xl aspect-[4/2] rounded-xl overflow-hidden bg-white/5 border border-white/10">
            <Image src={cat.image_url} alt={cat.title} fill sizes="100vw" className="object-cover" />
          </div>
        ) : null}
      </div>

      {children.length > 0 && (
        <section className="mb-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {children.map((sc) => (
              <a
                key={sc.id}
                href={`/catalog/${sc.id}`}
                className="group relative rounded-2xl overflow-hidden border border-amber-400/25 bg-white/[0.035] transition hover:border-amber-400/60 hover:shadow-[0_18px_50px_rgba(244,63,94,0.22),0_10px_24px_rgba(212,175,55,0.18)] hover:translate-y-[-2px] active:translate-y-0"
              >
                <div className="relative aspect-square bg-white/5">
                  {sc.image_url ? (
                    <Image src={sc.image_url} alt={sc.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(244,63,94,0.16),transparent_55%)]" />
                </div>
                <div className="p-3 text-center">
                  <div className="font-medium text-sm text-amber-200">{sc.title}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {children.length === 0 && (
        products.length === 0 ? (
          <p className="text-white/60">No products found for this category.</p>
        ) : (
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
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(244,63,94,0.16),transparent_55%)]" />
                </div>
                <div className="p-3 text-center">
                  <div className="font-medium text-sm text-amber-200">{p.title}</div>
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </main>
  )
}
