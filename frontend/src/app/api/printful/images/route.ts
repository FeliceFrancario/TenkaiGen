import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const PRINTFUL_API_BASE = 'https://api.printful.com'

async function pf(path: string) {
  const token = process.env.PRINTFUL_API_TOKEN
  if (!token) throw new Error('Missing PRINTFUL_API_TOKEN')
  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
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
    const productId = searchParams.get('product_id')
    if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })

    // Prefer v2 images endpoint first (includes model/lifestyle photos)
    let result: any
    try {
      const data = await pf(`/v2/catalog-products/${encodeURIComponent(productId)}/images`)
      result = (data?.data || data?.result || data)
    } catch (e: any) {
      const msg = String(e?.message || '')
      // If not found, fall back to the blank-images endpoint for transparent mockups
      if (/\b404\b/.test(msg)) {
        try {
          const alt = await pf(`/v2/catalog-products/${encodeURIComponent(productId)}/blank-images`)
          result = (alt?.data || alt?.result || alt)
        } catch (e2: any) {
          // v2 also failed, attempt v1 products detail to salvage variant previews
          try {
            const v1 = await pf(`/products/${encodeURIComponent(productId)}`)
            const v1res = (v1?.result || {}) as any
            const v1variants: any[] = Array.isArray(v1res.variants) ? v1res.variants : []
            // Build a result-like structure compatible with downstream flattener
            result = [
              {
                images: v1variants
                  .map((v: any) => {
                    const url = v?.image || v?.files?.[0]?.preview_url || ''
                    if (!url) return null
                    // Heuristic: front if url contains front/back markers otherwise default to front
                    const u = String(url).toLowerCase()
                    const placement = /back/.test(u) ? 'back' : 'front'
                    return { placement, image_url: url, background_color: null, background_image: null }
                  })
                  .filter(Boolean),
              },
            ]
          } catch (e3: any) {
            console.error('[api/printful/images] v1 fallback failed', e3?.message || e3)
            return NextResponse.json({ result: [] })
          }
        }
      } else {
        throw e
      }
    }

    // Normalize a small shape array for the client
    const arr: any[] = Array.isArray((result as any)?.data)
      ? (result as any).data
      : Array.isArray(result)
      ? result
      : []

    // v2 blank-images returns data[] entries with images[] per entry
    // v2 images may also return a similar nesting or a flat array; handle both
    const items: any[] = []
    const colorHexByName = new Map<string, string | null>()
    const colorNames = new Set<string>()
    for (const entry of arr) {
      const colorName = (entry as any)?.color || null
      const primaryHex = (entry as any)?.primary_hex_color || null
      if (colorName) {
        colorNames.add(String(colorName))
        if (!colorHexByName.has(String(colorName))) colorHexByName.set(String(colorName), primaryHex || null)
      }
      const imgs = Array.isArray((entry as any)?.images) ? (entry as any).images : Array.isArray(entry) ? entry : []
      if (imgs.length) {
        for (const im of imgs) {
          const url = im.image_url || im.url || im.image || im.preview_url || ''
          let placement = String(im.placement || im.view || im.view_name || im.side || im.type || '').toLowerCase()
          if (!placement) {
            const u = String(url).toLowerCase()
            if (/sleeve/.test(u) && /left/.test(u)) placement = 'sleeve_left'
            else if (/sleeve/.test(u) && /right/.test(u)) placement = 'sleeve_right'
            else if (/back/.test(u)) placement = 'back'
            else if (/front/.test(u)) placement = 'front'
          }
          items.push({
            placement,
            image_url: url,
            color_name: colorName || null,
            background_color: primaryHex || im.background_color || null,
            background_image: im.background_image || null,
          })
        }
      }
    }

    // Also try to append one JPG variant per color using v1 product details (matches by color name)
    try {
      const v1 = await pf(`/products/${encodeURIComponent(productId)}`)
      const v1res = (v1?.result || {}) as any
      const v1variants: any[] = Array.isArray(v1res.variants) ? v1res.variants : []
      const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const seenBase = new Set(items.map((it) => String(it.image_url || '').split('?')[0]))
      for (const cname of Array.from(colorNames)) {
        const targ = v1variants.find((v) => {
          const nm = norm(v?.name || '')
          return nm.includes(norm(cname)) && (v?.image || v?.files?.[0]?.preview_url)
        })
        if (!targ) continue
        const url = targ.image || targ?.files?.[0]?.preview_url
        if (!url) continue
        const base = String(url).split('?')[0]
        if (seenBase.has(base)) continue
        seenBase.add(base)
        items.push({
          placement: 'front',
          image_url: url,
          color_name: cname,
          background_color: colorHexByName.get(cname) || null,
          background_image: null,
        })
      }
    } catch {}

    return NextResponse.json({ result: items })
  } catch (e: any) {
    console.error('[api/printful/images] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
