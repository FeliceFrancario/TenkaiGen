import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import BackHomeBar from '@/components/back-home-bar'

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
    <main className="min-h-[70vh] px-6 py-10 text-white">
      <div className="max-w-6xl mx-auto">
        <BackHomeBar />
        <h1 className="text-3xl md:text-4xl font-semibold gradient-gold bg-clip-text text-transparent">Explore our catalog</h1>
        <p className="text-white/70 mt-2">Choose a category to begin</p>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {topCats.map((c) => (
            <Link
              key={c.id}
              href={`/catalog/${c.id}`}
              className="group rounded-2xl overflow-hidden border border-amber-400/25 bg-white/[0.035] transition shadow-[0_8px_30px_rgba(0,0,0,0.18)] hover:border-rose-400/50 hover:shadow-[0_18px_50px_rgba(244,63,94,0.22)] hover:translate-y-[-2px] active:translate-y-0 will-change-transform"
            >
              <div className="relative aspect-square bg-white/5">
                {c.image_url && (
                  <Image
                    src={c.image_url}
                    alt={c.title}
                    fill
                    className="object-cover"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(244,63,94,0.16),transparent_55%)]" />
              </div>
              <div className="p-3 text-center">
                <div className="font-semibold text-amber-200">{c.title}</div>
              </div>
            </Link>
          ))}
        </div>

        {topCats.length === 0 && (
          <div className="mt-8 text-white/70">No categories available at the moment.</div>
        )}
      </div>
    </main>
  )
}
