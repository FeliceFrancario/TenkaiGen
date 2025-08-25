import { ReactNode } from 'react'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

function absoluteUrl(path: string) {
  const h = headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}${path}`
}

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

async function getCategories(): Promise<PfCategory[]> {
  const res = await fetch(absoluteUrl('/api/printful/categories'), { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.result?.categories || []) as PfCategory[]
}

export default async function CatalogLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const activeId = Number(idStr)

  const cats = await getCategories()
  const byId = new Map<number, PfCategory>()
  for (const c of cats) byId.set(c.id, c)

  const topCats: PfCategory[] = TOP_TITLES.map((t) => cats.find((c) => norm(c.title) === norm(t))).filter(Boolean) as PfCategory[]

  // Compute active top ancestor among TOP_TITLES
  let activeTopId: number | null = null
  if (!Number.isNaN(activeId)) {
    let cur: PfCategory | undefined = byId.get(activeId)
    while (cur) {
      if (TOP_TITLES.some((t) => norm(t) === norm(cur!.title))) {
        activeTopId = cur.id
        break
      }
      cur = byId.get(cur.parent_id)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[280px_1fr]">
      <aside className="hidden md:block sticky top-0 h-screen p-6 bg-gradient-to-b from-amber-900/20 via-rose-900/10 to-transparent border-r border-amber-400/20">
        <div className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-rose-300 drop-shadow mb-4">
          Catalog
        </div>
        <nav className="space-y-2">
          {topCats.map((c) => {
            const selected = activeTopId === c.id
            return (
              <a
                key={c.id}
                href={`/catalog/${c.id}`}
                className={
                  'block rounded-lg px-3 py-2 border transition ' +
                  (selected
                    ? 'border-amber-400/60 bg-amber-500/10 shadow-[0_0_25px_rgba(251,191,36,0.25)] text-amber-100'
                    : 'border-amber-400/20 bg-white/[0.03] hover:border-amber-400/40 hover:bg-amber-500/10 text-white/80')
                }
              >
                {c.title}
              </a>
            )
          })}
        </nav>
        <div className="mt-6 text-xs text-white/60">
          Luxury mode
          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
        </div>
      </aside>
      <section className="bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.08),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.06),transparent_60%)]">
        {children}
      </section>
    </div>
  )
}
