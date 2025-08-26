import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

type PfCategory = { id: number; title: string; image_url: string | null; parent_id: number }

const TOP_TITLES = [
  "Men's clothing",
  "Women's clothing",
  "Kids' & youth clothing",
  'Hats',
  'Accessories',
  'Home & living',
]

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

async function absoluteUrl(path: string) {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}${path}`
}

async function getCategories(): Promise<PfCategory[]> {
  const res = await fetch(await absoluteUrl('/api/printful/categories'), { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.result?.categories || []) as PfCategory[]
}

export default async function CatalogHome() {
  const cats = await getCategories()
  const topCats = TOP_TITLES.map((t) => cats.find((c) => norm(c.title) === norm(t))).filter(Boolean) as PfCategory[]

  return (
    <main className="min-h-[70vh] px-6 py-10 text-white bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.08),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.06),transparent_60%)]">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-rose-300 drop-shadow">
          Explore our catalog
        </h1>
        <p className="text-white/70 mt-2">Choose a category to begin</p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topCats.map((c) => (
            <Link
              key={c.id}
              href={`/catalog/${c.id}`}
              className="group rounded-2xl overflow-hidden border border-amber-400/20 bg-white/[0.03] hover:border-amber-400/40 transition shadow-[0_8px_30px_rgba(0,0,0,0.15)] hover:shadow-[0_14px_40px_rgba(212,175,55,0.18)]"
            >
              <div className="relative h-40 bg-gradient-to-br from-amber-200/10 via-white/5 to-transparent">
                {c.image_url && (
                  <Image
                    src={c.image_url}
                    alt={c.title}
                    fill
                    className="object-contain p-6 drop-shadow-sm group-hover:scale-[1.02] transition"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(212,175,55,0.18),transparent_55%)]" />
              </div>
              <div className="p-4 flex items-center justify-between">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-white/70">Browse →</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Fallback in case categories are not loaded */}
        {topCats.length === 0 && (
          <div className="mt-8 text-white/70">No categories available at the moment.</div>
        )}
      </div>
    </main>
  )
}
