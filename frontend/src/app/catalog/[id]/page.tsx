import Image from 'next/image'
import Link from 'next/link'
import BackHomeBar from '@/components/back-home-bar'
import { SortingSelector } from '@/components/sorting-selector'
import { ProductGrid } from '@/components/product-grid'
import { headers, cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

async function absoluteUrl(path: string) {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}${path}`
}

type PfCategory = { id: number; title: string; image_url: string | null; parent_id: number }
type PfProduct = { id: number; title: string; main_category_id: number; thumbnail: string | null; _ships?: boolean; price?: string | null; currency?: string }

async function getCategories(): Promise<PfCategory[]> {
  const res = await fetch(await absoluteUrl(`/api/printful/categories`), { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.result?.categories || []) as PfCategory[]
}

async function getProducts(categoryId: number, page: number, locale: string, country: string, sort: string): Promise<{ products: PfProduct[], hasMore: boolean, total: number }> {
  const qs = new URLSearchParams({ category_id: String(categoryId), limit: '24', page: String(page) })
  if (locale) qs.set('locale', locale)
  if (country) qs.set('country_code', country)
  if (sort) qs.set('sort', sort)
  const res = await fetch(await absoluteUrl(`/api/printful/products?${qs.toString()}`), { cache: 'no-store' })
  if (!res.ok) return { products: [], hasMore: false, total: 0 }
  const data = await res.json()
  return {
    products: (data?.result || []) as PfProduct[],
    hasMore: data?.hasMore || false,
    total: data?.total || 0
  }
}

export default async function CatalogCategoryPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams?: Promise<{ page?: string, locale?: string, country?: string, sort?: string }> }) {
  const { id: idStr } = await params
  const sp = (await (searchParams || Promise.resolve({}))) as any
  const page = Math.max(1, Number(sp?.page || '1'))
  const cookieStore = await cookies()
  const locale = String(sp?.locale || cookieStore.get('locale')?.value || '')
  const country = String(sp?.country || cookieStore.get('country_code')?.value || '')
  const sort = String(sp?.sort || 'bestseller')
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
  const productData = children.length === 0 ? await getProducts(id, page, locale, country, sort) : { products: [], hasMore: false, total: 0 }
  const { products, hasMore, total } = productData

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
          <>
            <div className="flex justify-end mb-6">
              <SortingSelector />
            </div>
            <ProductGrid products={products} />
          </>
        )
      )}

      {children.length === 0 && (hasMore || page > 1) && (
        <div className="mt-6 flex justify-center gap-2">
          {page > 1 && (
            <Link href={`/catalog/${id}?page=${page - 1}${locale ? `&locale=${encodeURIComponent(locale)}` : ''}${country ? `&country=${encodeURIComponent(country)}` : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`} className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.06] text-sm hover:bg-white/[0.1] transition-colors">Previous</Link>
          )}
          {hasMore && (
            <Link href={`/catalog/${id}?page=${page + 1}${locale ? `&locale=${encodeURIComponent(locale)}` : ''}${country ? `&country=${encodeURIComponent(country)}` : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`} className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.06] text-sm hover:bg-white/[0.1] transition-colors">Next</Link>
          )}
        </div>
      )}
      
      {children.length === 0 && total > 0 && (
        <div className="mt-4 text-center text-sm text-white/60">
          Showing {Math.min((page - 1) * 24 + 1, total)}-{Math.min(page * 24, total)} of {total} products
        </div>
      )}
    </main>
  )
}