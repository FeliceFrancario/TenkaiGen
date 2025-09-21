import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string, locale?: string) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (locale) headers['X-PF-Language'] = locale
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    headers,
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Printful API ${path} failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const categoryId = searchParams.get('category_id')
    const limit = Number(searchParams.get('limit') || '24')
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const offset = (page - 1) * limit
    const locale = searchParams.get('locale') || (req.cookies.get('locale')?.value || '')
    const countryCode = (searchParams.get('country_code') || req.cookies.get('country_code')?.value || '').toUpperCase()

    if (!categoryId) {
      return NextResponse.json({ error: 'category_id is required' }, { status: 400 })
    }

    // 1) Get catalog products by category
    const list = await pf(`/products?category_id=${encodeURIComponent(categoryId)}&limit=${limit}&offset=${offset}&sort=bestselling`, locale)
    const products: Array<{ id: number; title: string; main_category_id: number }> = (list?.result || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      main_category_id: p.main_category_id,
    }))

    // 2) For each, fetch details and try to pick a better thumbnail (prefer front, on-woman for women's, ghost/flat for unisex)
    const detailed = await Promise.all(
      products.map(async (p) => {
        try {
          const detail = await pf(`/products/${p.id}`, locale)
          const firstVariant = (detail?.result?.variants || [])[0]
          let thumb = firstVariant?.image || null
          // Filter embroidery/knit-only products using v1 techniques
          try {
            const techniques: any[] = detail?.result?.product?.techniques || []
            const keys = techniques.map((t: any) => String(t?.key || t?.technique_key || '').toUpperCase()).filter(Boolean)
            const isEmbOrKnitOnly = keys.length > 0 && keys.every((k: string) => k === 'EMBROIDERY' || k === 'KNITWEAR')
            if (isEmbOrKnitOnly) return { ...p, thumbnail: null, _ships: true }
          } catch {}

          // Attempt to use v2 images for better, context-aware thumbnails
          try {
            const v2 = await pf(`/v2/catalog-products/${p.id}/images${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`, locale)
            const arr: any[] = Array.isArray(v2?.data) ? v2.data : Array.isArray(v2?.result) ? v2.result : Array.isArray(v2) ? v2 : []
            type Item = { placement: string; image_url: string; background_image?: string | null; background_color?: string | null; _score?: number }
            const items: Item[] = arr.map((it: any) => ({
              placement: String(it.placement || it.view || it.view_name || it.side || it.type || '').toLowerCase(),
              image_url: it.image_url || it.url || it.image || it.preview_url || '',
              background_image: it.background_image || null,
              background_color: it.background_color || null,
            }))
            const womens = /women|ladies|women's/i.test(p.title || '')
            const unisex = /unisex/i.test(p.title || '')
            const scored = items.map((it) => {
              const url = it.image_url || ''
              let s = 0
              if (it.background_image) s += 3
              if (it.background_color) s += 1
              if (/^front$/.test(it.placement) || /front/.test(it.placement)) s += 2
              if (womens) {
                if (/(onwoman|womens|women\b)/i.test(url)) s += 6
                if (/(onman\b|\bmen\b)/i.test(url)) s -= 3
              }
              if (unisex) {
                if (/(ghost|flat)/i.test(url)) s += 3
                if (/onman\b/i.test(url)) s -= 1
              }
              return { ...it, _score: s }
            })
            // prefer front images among ties
            scored.sort((a, b) => (b._score! - a._score!) || ((/front/.test(b.placement) ? 1 : 0) - (/front/.test(a.placement) ? 1 : 0)))
            const best = scored[0]
            if (best?.image_url) thumb = best.image_url
          } catch {}

          // Remove temporary placeholders
          if (thumb && /product_temporary_image\.jpg/.test(thumb)) {
            thumb = null
          }

          // Compute shipping availability for selected country (optional)
          let ships = true
          if (countryCode) {
            try {
              const sc = await pf(`/v2/catalog-products/${p.id}/shipping-countries`, locale)
              const list: any[] = (sc?.data || sc?.result || sc) as any[]
              ships = list.some((c: any) => String(c?.code || c?.country_code || '').toUpperCase() === countryCode)
            } catch {}
          }

          return { ...p, thumbnail: thumb, _ships: ships }
        } catch (e) {
          return { ...p, thumbnail: null }
        }
      })
    )

    // Remove products without usable thumbnails
    const withThumb = detailed.filter((d) => !!(d as any).thumbnail)
    // Sort to place non-shippable items last if country provided
    const sorted = countryCode ? (withThumb as any[]).sort((a, b) => Number(a._ships === false) - Number(b._ships === false)) : withThumb
    return NextResponse.json({ result: sorted, page, limit })
  } catch (e: any) {
    console.error('[api/printful/products] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
