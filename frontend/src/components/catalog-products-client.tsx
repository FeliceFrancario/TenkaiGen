'use client'

import { useEffect, useMemo, useState } from 'react'
import { ProductGrid } from './product-grid'
import { ProductGridSkeleton } from './product-skeleton'

export function CatalogProductsClient({ categoryId, page, locale, country, sort, gender = 'unisex' }: { categoryId: number, page: number, locale: string, country: string, sort: string, gender?: 'male' | 'female' | 'unisex' }) {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let abort = false
    const run = async () => {
      setLoading(true)
      const dbFetch = (async () => {
        try {
          const qs = new URLSearchParams({ category_id: String(categoryId), limit: '24', offset: String((page - 1) * 24), currency: 'USD' })
          if (sort) qs.set('sort', sort)
          const db = await fetch(`/api/db/products?${qs.toString()}`, { cache: 'no-store' })
          if (!db.ok) return null
          const data = await db.json()
          if (data?.success && Array.isArray(data?.result)) {
            return data.result.map((p: any) => ({
              id: typeof p.id === 'string' ? parseInt(p.id.replace(/-/g, '').substring(0, 8), 16) : p.id,
              title: p.title,
              main_category_id: typeof p.main_category_id === 'string' ? parseInt(p.main_category_id.replace(/-/g, '').substring(0, 8), 16) : p.main_category_id,
              thumbnail: p.thumbnail,
              _ships: p._ships,
              price: p.price,
              currency: p.currency,
              _db_id: p.db_id || p.id // preserve DB uuid for later price enrichment
            }))
          }
          return null
        } catch { return null }
      })()

      const pfFetch = (async () => {
        try {
          const qs = new URLSearchParams({ category_id: String(categoryId), limit: '24', page: String(page) })
          if (locale) qs.set('locale', locale)
          if (country) qs.set('country_code', country)
          if (sort) qs.set('sort', sort)
          if (gender) qs.set('gender', gender)
          const pf = await fetch(`/api/printful/products?${qs.toString()}`, { cache: 'no-store' })
          if (!pf.ok) return null
          const j = await pf.json()
          return Array.isArray(j?.result) ? j.result : []
        } catch { return null }
      })()

      const [dbRes, pfRes] = await Promise.all([dbFetch, pfFetch])
      if (abort) return
      const usedDb = !!(dbRes && dbRes.length > 0)
      const chosen = usedDb ? dbRes! : (pfRes || [])
      if (!usedDb) {
        // Strip Printful prices so we can replace with our DB price below
        for (const it of chosen) {
          if (it) {
            it.price = null
            it.currency = undefined
          }
        }
      }

      // Determine currency/region from country
      const cc = String(country || 'US').toUpperCase()
      const eurCountries = new Set(['IT','FR','DE','ES','NL','BE','PT','IE','FI','AT','GR','EE','LV','LT','LU','MT','SI','SK','CY'])
      const desiredCurrency = cc === 'GB' || cc === 'UK' ? 'GBP' : eurCountries.has(cc) ? 'EUR' : 'USD'
      const region = eurCountries.has(cc) || cc === 'GB' || cc === 'UK' ? 'eu' : 'us'

      // Enrich with our selling price if missing
      const items = [...chosen]
      // Map numeric Printful id onto items so we can resolve DB id
      // If items come from DB, they are already UUID-mapped; if from Printful, they are numeric
      const limitConc = 6
      let idx = 0
      async function processOne(i: number) {
        const item = items[i]
        if (!item) return
        try {
          // Resolve db id
          let dbId = (item as any)._db_id
          if (!dbId) {
            const pfId = typeof item.id === 'number' ? item.id : undefined
            if (pfId != null) {
              const r = await fetch(`/api/db/products?printful_id=${pfId}&limit=1`)
              if (r.ok) {
                const j = await r.json()
                const first = Array.isArray(j?.result) ? j.result[0] : null
                if (first?.id) dbId = first.id
              }
            }
          }
          if (!dbId) return
          const pr = await fetch(`/api/db/price?product_id=${encodeURIComponent(dbId)}&currency=${desiredCurrency}&region=${region}`)
          if (pr.ok) {
            const pj = await pr.json()
            const payload = pj?.result
            if (payload?.price != null) {
              item.price = Number(payload.price).toFixed(2)
              item.currency = payload.currency || desiredCurrency
              ;(item as any)._db_id = dbId
            }
          }
        } catch {}
      }
      const workers: Promise<void>[] = []
      for (let w = 0; w < limitConc; w++) {
        workers.push((async () => {
          while (idx < items.length) {
            const cur = idx++
            await processOne(cur)
          }
        })())
      }
      await Promise.all(workers)

      setProducts(items)
      setHasMore(Boolean(items && items.length === 24))
      setTotal(items?.length || 0)
      setLoading(false)
    }
    run()
    return () => { abort = true }
  }, [categoryId, page, locale, country, sort])

  if (loading) return <ProductGridSkeleton />
  if (!products || products.length === 0) {
    return <p className="text-white/60">No products found for this category.</p>
  }
  return <ProductGrid products={products as any[]} fromCategoryId={categoryId} />
}
