import Image from 'next/image'
import BackHomeBar from '@/components/back-home-bar'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function absoluteUrl(path: string) {
  const h = headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}${path}`
}

type PfCategory = { id: number; title: string; image_url: string | null; parent_id: number }
type PfProduct = { id: number; title: string; main_category_id: number; thumbnail: string | null }

async function getCategories(): Promise<PfCategory[]> {
  const res = await fetch(absoluteUrl(`/api/printful/categories`), { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.result?.categories || []) as PfCategory[]
}

async function getProducts(categoryId: number): Promise<PfProduct[]> {
  const res = await fetch(absoluteUrl(`/api/printful/products?category_id=${categoryId}&limit=24`), { cache: 'no-store' })
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
        <h1 className="text-3xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200 drop-shadow">{cat?.title || 'Category'}</h1>
        {cat?.image_url ? (
          <div className="mt-3 relative w-full max-w-3xl aspect-[4/2] rounded-xl overflow-hidden bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-transparent border border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.25)]">
            <Image src={cat.image_url} alt={cat.title} fill sizes="100vw" className="object-cover" />
          </div>
        ) : null}
      </div>

      {children.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3 text-white/90">Subcategories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {children.map((sc) => (
              <a
                key={sc.id}
                href={`/catalog/${sc.id}`}
                className="group relative rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent p-4 text-center hover:border-amber-400/40 hover:shadow-[0_0_30px_rgba(251,191,36,0.25)] transition"
              >
                <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity btn-shimmer" />
                <div className="font-medium text-sm text-amber-100">{sc.title}</div>
                {sc.image_url ? (
                  <div className="mt-3 relative w-full aspect-[4/3] rounded overflow-hidden bg-white/5">
                    <Image src={sc.image_url} alt={sc.title} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                  </div>
                ) : (
                  <div className="mt-3 relative w-full aspect-[4/3] rounded bg-white/5" />
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {children.length === 0 && (
        products.length === 0 ? (
          <p className="text-white/60">No products found for this category.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {products.map((p) => (
              <div key={p.id} className="group rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-transparent p-4 text-center hover:border-amber-400/40 hover:shadow-[0_0_30px_rgba(251,191,36,0.25)] transition">
                <div className="font-medium text-sm text-amber-100">{p.title}</div>
                {p.thumbnail ? (
                  <div className="mt-3 relative w-full aspect-[4/3] rounded overflow-hidden bg-white/5">
                    <Image src={p.thumbnail} alt={p.title} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                  </div>
                ) : (
                  <div className="mt-3 relative w-full aspect-[4/3] rounded bg-white/5" />
                )}
                {/* TODO: Link to a product detail page once implemented */}
              </div>
            ))}
          </div>
        )
      )}
    </main>
  )
}
