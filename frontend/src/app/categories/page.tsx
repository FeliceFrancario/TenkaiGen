"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import BackHomeBar from '@/components/back-home-bar'
import { useFlow } from '@/components/flow-provider'

type PfCategory = {
  id: number
  parent_id: number
  title: string
  image_url: string | null
}

type StructureItem = { title: string; matchTitle?: string }
type StructureGroup = { label: string; items: (string | StructureItem)[] }
type Section = { label: string; parentTitle: string; groups: StructureGroup[] }

const SECTIONS: Section[] = [
  {
    label: "Men's clothing",
    parentTitle: "Men's clothing",
    groups: [
      { label: "All men's clothing", items: [{ title: "All men's clothing", matchTitle: "Men's clothing" }] },
      {
        label: 'Shirts',
        items: ['T-shirts', 'All-over shirts', 'Polo shirts', 'Tank tops', '3/4 sleeve shirts', 'Long sleeve shirts', 'Embroidered shirts'],
      },
      { label: 'Jackets & vests', items: ['Jackets & vests'] },
      { label: 'Hoodies & sweatshirts', items: ['Hoodies', 'Sweatshirts'] },
      { label: 'Knitwear', items: ['Knitwear'] },
      { label: 'Bottoms', items: ['Sweatpants & joggers', 'Underwear', 'Leggings', 'Shorts', 'Pants'] },
      { label: 'Swimwear', items: ['Swimwear'] },
    ],
  },
  {
    label: "Women's clothing",
    parentTitle: "Women's clothing",
    groups: [
      { label: 'All women’s clothing', items: [{ title: 'All women’s clothing', matchTitle: "Women's clothing" }] },
      {
        label: 'Shirts',
        items: ['T-shirts', 'Polo shirts', 'All-over shirts', 'Tank tops', 'Crop tops', 'Embroidered shirts', '3/4 sleeve shirts', 'Long sleeve shirts'],
      },
      { label: 'Dresses', items: ['Dresses'] },
      { label: 'Knitwear', items: ['Knitwear'] },
      { label: 'Jackets & vests', items: ['Jackets & vests'] },
      { label: 'Hoodies & sweatshirts', items: ['Hoodies', 'Sweatshirts'] },
      { label: 'Bottoms', items: ['Sweatpants & joggers', 'Leggings', 'Skirts', 'Shorts', 'Pants'] },
      { label: 'Sports bras', items: ['Sports bras'] },
      { label: 'Swimwear', items: ['Swimwear'] },
      { label: 'Sleepwear', items: ['Sleepwear'] },
    ],
  },
  {
    label: "Kids' & youth clothing",
    parentTitle: "Kids' & youth clothing",
    groups: [
      { label: 'All kids & youth clothing', items: [{ title: 'All kids & youth clothing', matchTitle: "Kids' & youth clothing" }] },
      { label: 'Shirts', items: ['T-shirts', 'All-over shirts', '3/4 sleeve shirts', 'Long sleeve shirts'] },
      { label: 'Hoodies & sweatshirts', items: ['Hoodies & sweatshirts'] },
      { label: 'Hats', items: ['Hats'] },
      { label: 'Leggings', items: ['Leggings'] },
      { label: 'Baby bodysuits', items: ['Baby bodysuits'] },
      { label: 'Swimwear', items: ['Swimwear'] },
    ],
  },
  {
    label: 'Hats',
    parentTitle: 'Hats',
    groups: [
      { label: 'All hats', items: [{ title: 'All hats', matchTitle: 'All hats' }] },
      { label: 'Hats', items: ['Beanies', 'Dad hats / baseball caps', 'Snapbacks', 'Trucker hats', '5-panel hats', 'Mesh hats', 'Bucket hats', 'Visors'] },
    ],
  },
  {
    label: 'Accessories',
    parentTitle: 'Accessories',
    groups: [
      { label: 'All accessories', items: [{ title: 'All accessories', matchTitle: 'Accessories' }] },
      { label: 'Patches & Pins', items: ['Patches', 'Pins'] },
      { label: 'Bags', items: ['Tote bags', 'Duffle bags', 'Drawstring bags', 'Fanny packs', 'Backpacks', 'Handbags'] },
      { label: 'Hair accessories', items: ['Hair accessories'] },
      { label: 'Sports accessories', items: ['Sports accessories'] },
      { label: 'Footwear', items: ['Flip flops', 'Shoes', 'Socks'] },
      { label: 'Tech accessories', items: ['Phone cases', 'Earphone cases', 'Laptop cases', 'Mouse pads'] },
      { label: 'Face masks', items: ['Face masks'] },
    ],
  },
  {
    label: 'Home & living',
    parentTitle: 'Home & living',
    groups: [
      { label: 'All home & living products', items: [{ title: 'All home & living products', matchTitle: 'Home & living' }] },
      { label: 'Wall art', items: ['Posters', 'Framed posters', 'Canvas prints', 'Metal prints'] },
      { label: 'Home decor', items: ['Holiday decor', 'Blankets', 'Candles', 'Pillows & pillow cases', 'Magnets', 'Tableware', 'Flags & signs'] },
      { label: 'Drinkware & coasters', items: ['Water bottles', 'Mugs', 'Tumblers', 'Coasters', 'Glassware'] },
      { label: 'Stationery', items: ['Postcards', 'Notebooks', 'Stickers', 'Greeting cards'] },
      { label: 'Aprons', items: ['Aprons'] },
      { label: 'Towels', items: ['Towels'] },
      { label: 'Toys & games', items: ['Toys & games'] },
      { label: 'Pet products', items: ['Pet products'] },
      { label: 'Beauty', items: ['Beauty'] },
    ],
  },
]

export default function CategoriesPage() {
  const { shortcutMode, isGenerating, prompt } = useFlow()
  const [cats, setCats] = useState<PfCategory[]>([])

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      try {
        const res = await fetch('/api/printful/categories', { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        const list: PfCategory[] = data?.result?.categories || []
        setCats(list)
      } catch {}
    }
    run()
    return () => controller.abort()
  }, [])

  const byId = useMemo(() => {
    const m = new Map<number, PfCategory>()
    for (const c of cats) m.set(c.id, c)
    return m
  }, [cats])

  const childrenOf = useMemo(() => {
    const m = new Map<number, PfCategory[]>()
    for (const c of cats) {
      if (!m.has(c.parent_id)) m.set(c.parent_id, [])
      m.get(c.parent_id)!.push(c)
    }
    return m
  }, [cats])

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const findByTitle = (title: string) => cats.find((c) => norm(c.title) === norm(title)) || null
  const isUnder = (cat: PfCategory, ancestorId: number): boolean => {
    let cur: PfCategory | undefined = cat
    while (cur) {
      if (cur.id === ancestorId) return true
      cur = byId.get(cur.parent_id)
    }
    return false
  }
  // Aliases/variants to improve matching where Printful titles differ
  const ALIASES: Record<string, string[]> = {
    "dad hats / baseball caps": ["Dad hats", "Baseball caps", "Dad hats & baseball caps"],
    "pillows & pillow cases": ["Pillows", "Pillow cases", "Pillows & cases"],
    "earphone cases": ["AirPods cases", "AirPods case", "Earphone cases"],
    "laptop cases": ["Laptop sleeves", "Laptop cases", "Laptop sleeve"],
    "all women’s clothing": ["All women's clothing", "Women's clothing"],
    "hoodies & sweatshirts": ["Hoodies & sweatshirts", "Hoodies", "Sweatshirts"],
  }

  const findByTitleUnder = (title: string, ancestor: PfCategory | null) => {
    const candidates = [title, ...(ALIASES[norm(title)] || [])]
    // 1) Exact title matches
    for (const t of candidates) {
      const target = norm(t)
      const found = cats.find((c) => norm(c.title) === target && (!ancestor || isUnder(c, ancestor.id)))
      if (found) return found
    }
    // 2) Fuzzy contains matching within ancestor subtree
    const target = norm(title)
    const inScope = ancestor ? cats.filter((c) => isUnder(c, ancestor.id)) : cats
    const fuzzy = inScope.find((c) => norm(c.title).includes(target))
    return fuzzy || null
  }
  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
      <BackHomeBar />
      <h1 className="text-3xl font-semibold mb-6">All products</h1>
      <p className="text-white/60 mb-8">Browse categories, then pick a product → style → prompt.</p>
      <div className="space-y-12">
        {SECTIONS.map((section) => {
          const parent = findByTitle(section.parentTitle)
          return (
            <section key={section.label}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold">{section.label}</h2>
              </div>
              <div className="space-y-6">
                {section.groups.map((group) => {
                  // Resolve group items to categories
                  const items = group.items
                    .map((it) => (typeof it === 'string' ? { title: it, matchTitle: it } : it))
                    .map((it) => ({
                      display: it.title,
                      cat: it.matchTitle ? findByTitleUnder(it.matchTitle, parent) : null,
                    }))
                    .filter((x) => x.cat)

                  if (items.length === 0) return null
                  return (
                    <div key={group.label}>
                      <h3 className="text-sm font-medium text-white/80 mb-2">{group.label}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {items.map(({ display, cat }) => (
                          <Link
                            key={cat!.id}
                            href={`/catalog/${cat!.id}`}
                            className="group relative rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                          >
                            <div className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity btn-shimmer" />
                            <div className="font-medium">{display}</div>
                            {cat!.image_url ? (
                              <div className="mt-3 relative w-full aspect-[4/3] rounded overflow-hidden bg-white/5">
                                <Image src={cat!.image_url} alt={display} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
                              </div>
                            ) : (
                              <div className="mt-3 relative w-full aspect-[4/3] rounded bg-white/5" />
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
