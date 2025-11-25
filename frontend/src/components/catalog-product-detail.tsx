'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import Image from 'next/image'
import { STYLES } from '@/lib/styles'
import { useFlow } from '@/components/flow-provider'
import { useRouter } from 'next/navigation'

// Country list with flags
const COUNTRIES = [
  { code: 'US', name: 'United States', flag: 'us', needsState: true },
  { code: 'CA', name: 'Canada', flag: 'ca', needsState: true },
  { code: 'AU', name: 'Australia', flag: 'au', needsState: true },
  { code: 'GB', name: 'United Kingdom', flag: 'gb' },
  { code: 'DE', name: 'Germany', flag: 'de' },
  { code: 'FR', name: 'France', flag: 'fr' },
  { code: 'ES', name: 'Spain', flag: 'es' },
  { code: 'IT', name: 'Italy', flag: 'it' },
  { code: 'NL', name: 'Netherlands', flag: 'nl' },
  { code: 'BE', name: 'Belgium', flag: 'be' },
  { code: 'PT', name: 'Portugal', flag: 'pt' },
  { code: 'IE', name: 'Ireland', flag: 'ie' },
]

// US States
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
]

// Canadian Provinces
const CA_PROVINCES = [
  { code: 'AB', name: 'Alberta' }, { code: 'BC', name: 'British Columbia' },
  { code: 'MB', name: 'Manitoba' }, { code: 'NB', name: 'New Brunswick' },
  { code: 'NL', name: 'Newfoundland and Labrador' }, { code: 'NS', name: 'Nova Scotia' },
  { code: 'ON', name: 'Ontario' }, { code: 'PE', name: 'Prince Edward Island' },
  { code: 'QC', name: 'Quebec' }, { code: 'SK', name: 'Saskatchewan' },
  { code: 'NT', name: 'Northwest Territories' }, { code: 'NU', name: 'Nunavut' },
  { code: 'YT', name: 'Yukon' }
]

// Australian States
const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' }, { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' }, { code: 'SA', name: 'South Australia' },
  { code: 'WA', name: 'Western Australia' }, { code: 'TAS', name: 'Tasmania' },
  { code: 'NT', name: 'Northern Territory' }, { code: 'ACT', name: 'Australian Capital Territory' }
]

function CountrySelectorInline({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentCountry = COUNTRIES.find(c => c.code === value) || COUNTRIES[0]

  return (
    <div className="mt-3 relative inline-block" ref={dropdownRef}>
      <div className="text-xs text-white/50 mb-1">Ship to</div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 pr-8 flex items-center gap-2 text-sm text-white/90 transition-colors min-w-[180px]"
      >
        <span className={`fi fi-${currentCountry.flag}`}></span>
        <span className="truncate">{currentCountry.name}</span>
        <svg className={`w-4 h-4 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 rounded-lg border border-white/15 bg-black/95 backdrop-blur-md shadow-2xl z-50 max-h-60 overflow-y-auto min-w-[220px]">
          {COUNTRIES.map((country) => (
            <button
              key={country.code}
              onClick={() => { onChange(country.code); setIsOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/10 transition-colors ${
                country.code === value ? 'bg-amber-500/20 text-amber-200' : 'text-white/90'
              }`}
            >
              <span className={`fi fi-${country.flag}`}></span>
              <span className="truncate">{country.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export type CatalogProduct = {
  id: number
  catalog_product_id?: number | string | null
  title: string
  description?: string
  brand?: string | null
  model?: string | null
  sizes?: string[]
  colors?: { name: string; value?: string | null }[]
  image?: string | null
  variants: Array<{
    id: number
    name: string
    size?: string | null
    color?: string | null
    color_code?: string | null
    image?: string | null
  }>
}

export default function CatalogProductDetail({ product, genderContext = 'unisex' }: { product: CatalogProduct; genderContext?: 'male' | 'female' | 'unisex' }) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined)
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined)
  const [selectedStyle, setSelectedStyle] = useState<string | undefined>(undefined)
  const router = useRouter()
  const { isGenerating, setStyle: setFlowStyle, setColor: setFlowColor, setSize: setFlowSize, setPrintArea: setFlowPrintArea } = useFlow()

  // Images from v2 endpoint (placement + background info)
  type PlImage = { placement: string; image_url: string; color_name?: string | null; background_color?: string | null; background_image?: string | null }
  const [plImages, setPlImages] = useState<PlImage[]>([])
  const [placement, setPlacement] = useState<string>('front')
  type ScoredImage = PlImage & { _score: number; _key: string }
  const [allImages, setAllImages] = useState<ScoredImage[]>([])
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null)

  // Pricing + shipping
  const [geoCountry, setGeoCountry] = useState<string>('US')
  // Size guide
  type SizeValue = { size: string; value?: string | null; min_value?: string | null; max_value?: string | null }
  type SizeRow = { type_label: string; values: SizeValue[] }
  type SizeTable = { type: string; unit: string; description?: string; image_url?: string; image_description?: string; measurements: SizeRow[] }
  const [sizeTables, setSizeTables] = useState<SizeTable[] | null>(null)
  const [sizeLoading, setSizeLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setSizeLoading(true)
      try {
        const catalogId = (product as any).catalog_product_id || product.id
        const r = await fetch(`/api/printful/sizes?product_id=${catalogId}`)
        if (!r.ok) return
        const j = await r.json()
        const res = j?.result || {}
        const tables: SizeTable[] = Array.isArray(res?.size_tables) ? res.size_tables : []
        if (mounted) setSizeTables(tables)
      } finally {
        setSizeLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [product.id])
  const [priceLabel, setPriceLabel] = useState<string>('')
  const [priceCurrency, setPriceCurrency] = useState<string>('')
  const [shipLabel, setShipLabel] = useState<string>('—')
  const [shipEta, setShipEta] = useState<string>('')
  const [shipCurrency, setShipCurrency] = useState<string>('')
  const [shippingAvailable, setShippingAvailable] = useState<boolean>(true)
  const [regionCode, setRegionCode] = useState<string>('')

  // Local size sorting since util was removed
  const sortSizesLocal = (arr: string[]) => {
    const order = ['XXS','XS','S','M','L','XL','XXL','2XL','3XL','4XL','5XL']
    const idx = (s: string) => {
      const up = s.toUpperCase().replace(/\s+/g,'')
      const oi = order.indexOf(up)
      if (oi >= 0) return oi
      const n = parseInt(up, 10)
      if (!Number.isNaN(n)) return 100 + n
      if (/ONE\s*SIZE|OS/i.test(s)) return 200
      return 300
    }
    return [...arr].sort((a, b) => idx(a) - idx(b))
  }

  const colors = useMemo(() => {
    // Derive from variants first (more reliable), fallback to product.colors
    const fromVariants: { name: string; code?: string | null }[] = []
    for (const v of product.variants || []) {
      const name = v.color || undefined
      if (!name) continue
      if (!fromVariants.find((c) => c.name === name)) {
        fromVariants.push({ name, code: v.color_code })
      }
    }
    if (fromVariants.length) return fromVariants
    return (product.colors || []).map((c) => ({ name: c.name, code: c.value }))
  }, [product])

  const sizes = useMemo(() => {
    const set = new Set<string>()
    for (const v of product.variants || []) {
      if (v.size) set.add(String(v.size))
    }
    if (set.size) return sortSizesLocal(Array.from(set))
    return sortSizesLocal(product.sizes || [])
  }, [product])

  useEffect(() => {
    if (!selectedColor && colors.length) setSelectedColor(colors[0]?.name)
  }, [colors, selectedColor])

  useEffect(() => {
    if (!selectedSize && sizes.length) setSelectedSize(sizes[0])
  }, [sizes, selectedSize])

  const activeVariant = useMemo(() => {
    // Try exact match
    let v = product.variants.find((vv) => (selectedColor ? vv.color === selectedColor : true) && (selectedSize ? vv.size === selectedSize : true))
    if (v) return v
    // Try color-only
    v = product.variants.find((vv) => (selectedColor ? vv.color === selectedColor : true))
    if (v) return v
    // Fallback to first
    return product.variants[0]
  }, [product, selectedColor, selectedSize])

  // Sync selection state into shared flow for global banner and downstream steps
  useEffect(() => {
    setFlowColor(selectedColor)
  }, [selectedColor, setFlowColor])
  useEffect(() => {
    setFlowSize(selectedSize)
  }, [selectedSize, setFlowSize])
  useEffect(() => {
    const key = (placement || '').toLowerCase()
    const mapped = key.includes('back') ? 'Back' : 'Front' as 'Front' | 'Back'
    setFlowPrintArea(mapped)
  }, [placement, setFlowPrintArea])
  useEffect(() => {
    if (selectedStyle) setFlowStyle(selectedStyle)
  }, [selectedStyle, setFlowStyle])

  // Detect user country (edge header) for shipping estimation
  useEffect(() => {
    let mounted = true
    let hadCookie = false
    // 1) Prefer persisted selector cookie if present
    try {
      const all = typeof document !== 'undefined' ? document.cookie || '' : ''
      const m = /(?:^|; )country_code=([^;]+)/.exec(all)
      if (m && m[1]) {
        hadCookie = true
        if (mounted) setGeoCountry(decodeURIComponent(m[1]).toUpperCase())
      }
      const r = /(?:^|; )region_code=([^;]+)/.exec(all)
      if (r && r[1] && mounted) setRegionCode(decodeURIComponent(r[1]).toUpperCase())
    } catch {}
    // 2) Edge geo fallback only if no cookie preset
    if (!hadCookie) {
      fetch('/api/geo').then(r => r.json()).then(j => {
        if (!mounted) return
        if (j?.countryCode) setGeoCountry(String(j.countryCode))
        if (j?.regionCode) setRegionCode(String(j.regionCode))
      }).catch(() => {})
    }
    // Client-side locale fallback (e.g., it-IT -> IT) if edge header is missing or defaults to US
    try {
      const lang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : ''
      const m = /-([A-Z]{2})$/i.exec(lang)
      if (m && m[1]) {
        const cc = m[1].toUpperCase()
        setGeoCountry((prev) => (prev ? prev : cc))
      }
    } catch {}
    return () => { mounted = false }
  }, [])

  // Fetch selling price from DB (not Printful) for catalog product
  useEffect(() => {
    let mounted = true
    const catalogId = (product as any).catalog_product_id || product.id
    if (!catalogId) return
    ;(async () => {
      try {
        // Infer a currency from country
        const cc = String(geoCountry || 'US').toUpperCase()
        const eurCountries = new Set(['IT','FR','DE','ES','NL','BE','PT','IE','FI','AT','GR','EE','LV','LT','LU','MT','SI','SK','CY'])
        const desiredCurrency = cc === 'GB' || cc === 'UK' ? 'GBP' : eurCountries.has(cc) ? 'EUR' : 'USD'
        const sellingRegion = eurCountries.has(cc) || cc === 'GB' || cc === 'UK' ? 'eu' : 'us'
        // Find DB id via a lightweight lookup if not present
        let dbId = (product as any)._db_id
        if (!dbId) {
          try {
            const r = await fetch(`/api/db/products?limit=1&printful_id=${encodeURIComponent(String(product.id))}`)
            if (r.ok) {
              const j = await r.json()
              const first = Array.isArray(j?.result) ? j.result[0] : null
              if (first?.id) dbId = first.id
            }
          } catch {}
        }
        if (!dbId) return
        const res = await fetch(`/api/db/price?product_id=${encodeURIComponent(dbId)}&currency=${desiredCurrency}&region=${sellingRegion}`)
        if (!res.ok) return
        const data = await res.json()
        const payload = data?.result
        if (payload?.price != null) {
          setPriceLabel(Number(payload.price).toFixed(2))
          setPriceCurrency(payload.currency || desiredCurrency)
        }
      } catch {}
    })()
    return () => { mounted = false }
  }, [product.id, geoCountry])

  // Fetch shipping availability and estimate for the selected variant and country
  useEffect(() => {
    let mounted = true
    const catalogId = (product as any).catalog_product_id || product.id
    if (!catalogId || !activeVariant?.id || !geoCountry) return
    ;(async () => {
      try {
        // Use Printful v2 shipping rates with catalog_variant_id
        const catalogVariantId = activeVariant?.catalog_variant_id || activeVariant?.id
        if (!catalogVariantId) {
          setShipLabel('—')
          setShipEta('at checkout')
          setShippingAvailable(true)
          return
        }
        
        const params = new URLSearchParams({
          catalog_variant_id: String(catalogVariantId),
          country_code: geoCountry,
          quantity: '1'
        })
        if ((geoCountry === 'US' || geoCountry === 'CA' || geoCountry === 'AU') && regionCode) {
          params.set('state_code', regionCode)
        }
        
        console.log('[Shipping] Fetching rates:', { catalogVariantId, geoCountry, regionCode, url: `/api/shipping-rates?${params.toString()}` })
        
        const sr = await fetch(`/api/shipping-rates?${params.toString()}`)
        if (sr.ok) {
          const j = await sr.json()
          console.log('[Shipping] API response:', j)
          if (!j.available) {
            setShipLabel('Unavailable')
            setShippingAvailable(false)
            setShipEta('')
            return
          }
          const rates: any[] = j?.rates || []
          if (rates.length === 0) {
            // No rates but available - might need more address details
            console.log('[Shipping] Empty rates, needs state?', { geoCountry, regionCode })
            setShipLabel('—')
            setShipEta((geoCountry === 'US' || geoCountry === 'CA' || geoCountry === 'AU') && !regionCode ? 'Select state for estimate' : 'at checkout')
            setShippingAvailable(true)
            return
          }
          // Pick the cheapest standard rate
          let best: any = null
          for (const r of rates) {
            const amt = Number(r?.rate)
            if (!Number.isFinite(amt)) continue
            if (!best || amt < Number(best._amt)) best = { ...r, _amt: amt }
          }
          if (best && mounted) {
            setShipLabel(String(best._amt.toFixed(2)))
            setShipCurrency(best?.currency || 'USD')
            setShippingAvailable(true)
            const eta = best?.min_delivery_days && best?.max_delivery_days
              ? `${best.min_delivery_days}–${best.max_delivery_days} days`
              : ''
            setShipEta(eta)
          } else {
            setShipLabel('—')
            setShipCurrency('')
            setShipEta('at checkout')
            setShippingAvailable(true)
          }
        } else {
          // API error - assume available but show checkout
          setShipLabel('—')
          setShipEta('at checkout')
          setShippingAvailable(true)
        }
      } catch {
        // Error - assume available but show checkout
        setShipLabel('—')
        setShipEta('at checkout')
        setShippingAvailable(true)
      }
    })()
    return () => { mounted = false }
  }, [product.id, activeVariant?.id, selectedColor, selectedSize, geoCountry, regionCode])

  // Persist country/state selector to cookies
  const persistGeo = (country: string, region?: string) => {
    try {
      const cc = (country || '').toUpperCase()
      const rc = (region || '').toUpperCase()
      const opts = 'path=/; max-age=31536000; SameSite=Lax'
      document.cookie = `country_code=${encodeURIComponent(cc)}; ${opts}`
      if (rc) document.cookie = `region_code=${encodeURIComponent(rc)}; ${opts}`
      setGeoCountry(cc)
      if (rc) setRegionCode(rc)
    } catch {}
  }

  // Normalize placement keys and labels
  const normPlacement = (p: string) => {
    const s = (p || '').toLowerCase()
    if (s.includes('front')) return { key: 'front', label: 'Front' }
    if (s.includes('back')) return { key: 'back', label: 'Back' }
    if (s.includes('sleeve_left') || s === 'left') return { key: 'left', label: 'Left sleeve' }
    if (s.includes('sleeve_right') || s === 'right') return { key: 'right', label: 'Right sleeve' }
    return { key: s || 'front', label: (p || 'Front').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) }
  }

  // Helper: classify mockup style from URL for ordering
  const styleRank = (url: string) => {
    const u = String(url).toLowerCase()
    
    // Gender-specific prioritization based on context
    if (genderContext === 'female') {
      if (/(onwoman|womens|women\b)/i.test(u)) return 0 // Women's model first
      if (/flat/.test(u)) return 1
      if (/ghost/.test(u)) return 2
      if (/(onman\b|\bmen\b)/i.test(u)) return 3 // Men's model last
      if (/model/i.test(u)) return 4 // Generic model
      return 5
    } else if (genderContext === 'male') {
      if (/(onman\b|\bmen\b)/i.test(u)) return 0 // Men's model first
      if (/flat/.test(u)) return 1
      if (/ghost/.test(u)) return 2
      if (/(onwoman|womens|women\b)/i.test(u)) return 3 // Women's model last
      if (/model/i.test(u)) return 4 // Generic model
      return 5
    } else {
      // Unisex: prefer neutral first
      if (/flat/.test(u)) return 0
      if (/ghost/.test(u)) return 1
      if (/(onman\b|\bmen\b|onwoman|womens|women\b|model)/i.test(u)) return 2 // Any model
      return 3
    }
  }
  const normUrl = (u: string) => String(u || '').split('?')[0]

  // Prefer baked (jpg/webp) over transparent (png) assets when available
  const fileExtRank = (url: string) => {
    const u = normUrl(url).toLowerCase()
    if (/(\.jpg|\.jpeg|\.webp)$/.test(u)) return 0
    if (/\.png$/.test(u)) return 1
    return 2
  }

  const isPng = (url?: string | null) => !!url && /\.png($|\?)/i.test(String(url))

  // Model-only filter (remove flat/ghost); fallback to all if none
  const isModelUrl = (url?: string | null) => {
    const u = String(url || '').toLowerCase()
    if (!u) return false
    if (/flat|ghost/.test(u)) return false
    return /(onman|onmale|\bmen\b|male|guy|onwoman|onfemale|womens|women\b|female|girl|model|lifestyle)/i.test(u)
  }

  // Gender helpers and preference
  const isMaleModel = (url: string) => /(onman\b|\bmen\b|male|guy)/i.test(String(url))
  const isFemaleModel = (url: string) => /(onwoman|womens|women\b|female|girl)/i.test(String(url))
  const genderPrefRank = (url: string) => (isMaleModel(url) ? 0 : isFemaleModel(url) ? 1 : 2)
  // User requested more men models
  const preferMenModels = true

  // Helper: color matching across varying metadata
  const colorMatches = (img: PlImage, selName?: string, selHex?: string | null) => {
    const bgHex = normalizeHex(img.background_color || null)
    if (selHex && bgHex && selHex === bgHex) return true
    if (!selName) return false
    // Exact color name match from API (most reliable)
    const imgColor = String(img.color_name || '').trim().toLowerCase()
    const selColor = String(selName || '').trim().toLowerCase()
    if (imgColor && selColor && imgColor === selColor) return true
    // Normalized name equality (generic, no fuzzy tokens)
    const sanitize = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const imgNorm = sanitize(imgColor)
    const selNorm = sanitize(selColor)
    if (imgNorm && selNorm && imgNorm === selNorm) return true
    return false
  }

  // Detect if current color selection is heather/textured, so we prefer a background image texture over flat color when using transparent PNGs
  const isHeatherSelected = useMemo(() => {
    const n = String(selectedColor || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    return /heather|athleticheather|darkheather|ash|oatmeal|triblend|marble|slub/.test(n)
  }, [selectedColor])

  // Gender context derived from product title and active variant
  const { womensSelected, mensSelected, unisexSelected } = useMemo(() => {
    const t = product.title || ''
    const vname = activeVariant?.name || ''
    const womens = /women|ladies|women's/i.test(t) || /women|ladies|women's/i.test(vname)
    const mens = /men|men's\b/i.test(t) || /men|men's\b/i.test(vname)
    const unisex = /unisex/i.test(t) || /unisex/i.test(vname)
    return { womensSelected: womens && !mens, mensSelected: mens && !womens, unisexSelected: unisex }
  }, [product.title, activeVariant?.name])

  // Selected color hex resolver
  const normalizeHex = (hex?: string | null): string | null => {
    if (!hex) return null
    let h = String(hex).trim().replace(/^#/, '')
    if (!/^[0-9a-fA-F]{3,8}$/.test(h)) return null
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    if (h.length >= 6) h = h.slice(0, 6)
    return `#${h.toUpperCase()}`
  }
  const selectedColorHex = useMemo(() => {
    const match = colors.find((c) => c.name === selectedColor)
    const fromSelected = normalizeHex(match?.code || null)
    if (fromSelected) return fromSelected
    const fromVariant = normalizeHex(activeVariant?.color_code || null)
    if (fromVariant) return fromVariant
    // Fallback: try to infer from any image that carries a background_color for this color
    const selName = String(selectedColor || '').toLowerCase()
    const imgMatch = allImages.find((i) => (
      String(i.color_name || '').toLowerCase() === selName) && !!normalizeHex(i.background_color || null)
    )
    const fromImages = normalizeHex(imgMatch?.background_color || null)
    return fromImages
  }, [activeVariant?.color_code, colors, selectedColor, allImages])

  // Fetch v2 images for placements and gallery
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const catalogId = (product as any).catalog_product_id || product.id
        const res = await fetch(`/api/printful/images?product_id=${catalogId}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        let list: PlImage[] = (json?.result || [])
        // Remove labeling and embroidery placements/assets completely
        const allowed = new Set(['front','back','left','right'])
        list = list.filter((it) => {
          const key = normPlacement(it.placement).key
          const p = String(it.placement || '').toLowerCase()
          const u = String(it.image_url || '').toLowerCase()
          if (!allowed.has(key)) return false
          if (p.includes('label') || p.includes('embroid')) return false
          if (u.includes('embroidery') || u.includes('/label')) return false
          return true
        })
        if (!mounted) return
        // Scoring preferences per placement: background_image > background_color; apply gender context
        const scored: ScoredImage[] = list.map((it) => {
          const url = it.image_url || ''
          let s = 0
          if (it.background_image) s += 4
          if (it.background_color) s += 1
          // prefer canonical front/back over "_large" only slightly
          const norm = normPlacement(it.placement).key
          if (norm === 'front') s += 1
          
          // Apply gender-specific scoring based on context
          if (genderContext === 'female') {
            if (/(onwoman|womens|women\b)/i.test(url)) s += 10
            if (/(onman\b|\bmen\b)/i.test(url)) s -= 5
          } else if (genderContext === 'male') {
            if (/(onman\b|\bmen\b)/i.test(url)) s += 10
            if (/(onwoman|womens|women\b)/i.test(url)) s -= 5
          } else {
            // Unisex: prefer neutral
            if (/(flat|ghost)/i.test(url)) s += 5
          }
          
          return { ...it, _score: s, _key: norm }
        })
        // Save all scored images for gallery (stable sort by score desc), ensure non-empty src
        // Do NOT dedupe here; preserve duplicates across colors for same URL
        const allSorted = scored
          .filter((it) => !!(it.image_url && String(it.image_url).trim().length > 0))
          // Sort by style rank (model > ghost > flat > other), then score desc
          .sort((a, b) => {
            const r = styleRank(a.image_url) - styleRank(b.image_url)
            if (r !== 0) return r
            return b._score - a._score
          })
        setAllImages(allSorted)

        // Deduplicate by normalized key for placement options (restricted to allowed already), pick highest score
        const byKey = new Map<string, ScoredImage>()
        for (const it of scored) {
          const { key } = normPlacement(it.placement)
          const prev = byKey.get(key)
          if (!prev) {
            byKey.set(key, it)
          } else if (it._score > prev._score) {
            byKey.set(key, it)
          } else if (it._score === prev._score) {
            const prevOk = !!(prev.image_url && prev.image_url.trim().length > 0)
            const itOk = !!(it.image_url && it.image_url.trim().length > 0)
            if (itOk && !prevOk) byKey.set(key, it)
          }
        }
        const dedup = Array.from(byKey.values())
        setPlImages(dedup)
        // Default placement only if current placement is unset or not present
        const keys = dedup.map((i) => normPlacement(i.placement).key)
        if (!keys.includes(placement)) {
          const next = keys.includes('front') ? 'front' : (keys[0] || 'front')
          setPlacement(next)
        }
        // Clear manual selection if it no longer exists
        if (selectedImageUrl && !allSorted.find((i) => i.image_url === selectedImageUrl)) {
          setSelectedImageUrl(null)
        }
      } catch {}
    }
    load()
    return () => { mounted = false }
  }, [product.id, womensSelected, mensSelected, unisexSelected])

  // Pick image and background by selected placement or explicit thumbnail click
  const placementImage = useMemo(() => {
    const match = plImages.find((it) => normPlacement(it.placement).key === placement)
    return match || null
  }, [plImages, placement])

  const selectedItem = useMemo(() => {
    if (selectedImageUrl) return allImages.find((i) => i.image_url === selectedImageUrl) || null
    // Use all images for main pick so true per-color PNGs can be selected
    const matches = [...allImages]
    // Soft preference for current placement without filtering others
    const prefersPlacement = (_u: string, p: string) => (normPlacement(p).key === placement ? 0 : 1)
    matches.sort((a, b) => {
      // Prefer assets that match the selected color (so real per-color mockups swap in)
      const am = colorMatches(a, selectedColor, selectedColorHex) ? 0 : 1
      const bm = colorMatches(b, selectedColor, selectedColorHex) ? 0 : 1
      if (am !== bm) return am - bm
      // If both match color, prefer transparent PNGs to allow background colorization when needed
      const ap = isPng(a.image_url) ? 0 : 1
      const bp = isPng(b.image_url) ? 0 : 1
      if (am === 0 && bm === 0 && ap !== bp) return ap - bp
      if (preferMenModels) {
        const g = genderPrefRank(a.image_url) - genderPrefRank(b.image_url)
        if (g !== 0) return g
      }
      const pr = prefersPlacement(a.image_url, a.placement) - prefersPlacement(b.image_url, b.placement)
      if (pr !== 0) return pr
      const r = styleRank(a.image_url) - styleRank(b.image_url)
      if (r !== 0) return r
      const fe = fileExtRank(a.image_url) - fileExtRank(b.image_url)
      if (fe !== 0) return fe
      return b._score - a._score
    })
    return matches[0] || null
  }, [allImages, placement, selectedImageUrl, selectedColor, selectedColorHex])

  const activeImage = selectedItem?.image_url || activeVariant?.image || product.image || placementImage?.image_url || undefined

  // When the active image changes, reset measured dims so container aspect ratio re-computes.
  // This prevents background letterbox vs image ratio mismatches and flicker artifacts.
  useEffect(() => {
    setImgDims(null)
  }, [activeImage])

  // Resolve background (image/color) for the current placement that best matches the selected color
  const selectedBg = useMemo(() => {
    const placeKey = placement
    // Use the full images pool (not deduped by placement) so we can match color-specific backgrounds
    const candidates = allImages.filter((it) => normPlacement(it.placement).key === placeKey)
    const ranked = candidates
      .map((it) => ({ it, match: colorMatches(it, selectedColor, selectedColorHex) }))
      .sort((a, b) => {
        if (a.match !== b.match) return a.match ? -1 : 1
        const ai = a.it.background_image ? 1 : 0
        const bi = b.it.background_image ? 1 : 0
        if (ai !== bi) return bi - ai
        const ac = a.it.background_color ? 1 : 0
        const bc = b.it.background_color ? 1 : 0
        if (ac !== bc) return bc - ac
        return 0
      })
    return ranked[0]?.it || null
  }, [allImages, placement, selectedColor, selectedColorHex])

  const preferredBgColor = useMemo(() => {
    return selectedColorHex || normalizeHex(selectedBg?.background_color || null) || normalizeHex(placementImage?.background_color || null)
  }, [selectedBg?.background_color, placementImage?.background_color, selectedColorHex])

  // Only use a background image if: (1) active asset is a transparent PNG, (2) the selection is heather-like, and (3) the background matches the selected color
  const bgImageUrl = useMemo(() => {
    const transparent = isPng(activeImage)
    if (!transparent) return undefined
    if (!isHeatherSelected) return undefined
    const cand = selectedBg && colorMatches(selectedBg, selectedColor, selectedColorHex) ? selectedBg : null
    const fallback = !cand && placementImage && colorMatches(placementImage, selectedColor, selectedColorHex) ? placementImage : null
    const chosen = cand || fallback
    return chosen?.background_image || undefined
  }, [activeImage, selectedBg, placementImage, selectedColor, selectedColorHex, isHeatherSelected])

  const thumbs = useMemo(() => {
    let arr = allImages as ScoredImage[]
    // Keep consistent stack across colors; show only model images if available
    const models = arr.filter((i) => isModelUrl(i.image_url))
    arr = models.length ? models : arr
    // Filter invalid src
    arr = arr.filter((it) => !!(it.image_url && it.image_url.trim().length > 0))
    // Dedupe by base URL
    const seen = new Set<string>()
    const uniq = arr.filter((it) => {
      const key = normUrl(it.image_url)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    // Sort: prefer male models (if requested), then model>ghost>flat, then baked ext, then score
    const sorted = uniq.sort((a, b) => {
      if (preferMenModels) {
        const g = genderPrefRank(a.image_url) - genderPrefRank(b.image_url)
        if (g !== 0) return g
      }
      const r = styleRank(a.image_url) - styleRank(b.image_url)
      if (r !== 0) return r
      const fe = fileExtRank(a.image_url) - fileExtRank(b.image_url)
      if (fe !== 0) return fe
      return b._score - a._score
    })
    return sorted.slice(0, 8)
  }, [allImages])

  const onStartDesigning = () => {
    const catalogId = (product as any).catalog_product_id || product.id
    const q = new URLSearchParams()
    if (selectedColor) q.set('color', selectedColor)
    if (selectedSize) q.set('size', selectedSize)
    if (placement) q.set('placement', placement)
    // Add color hex for designer background
    if (selectedColorHex) q.set('color_hex', selectedColorHex)
    router.push(`/designer/${catalogId}?${q.toString()}`)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">
      {/* Left: imagery + variant selectors */}
      <div>
        <div className="mb-4">
          <h1 className="text-3xl font-semibold">{product.title}</h1>
          {product.brand && (
            <div className="text-white/60 text-sm mt-1">{product.brand}{product.model ? ` • ${product.model}` : ''}</div>
          )}
        </div>
        <div className="md:flex md:gap-3">
          {/* Thumbnails (desktop) */}
          <div className="hidden md:flex md:flex-col md:w-20 gap-2 overflow-auto max-h-[520px] pr-1">
            {thumbs.map((t) => {
              if (!t.image_url) return null
              const isActive = (selectedItem?.image_url || activeImage) === t.image_url
              return (
                <button
                  key={`${normUrl(t.image_url)}|${normPlacement(t.placement).key}`}
                  onClick={() => { setSelectedImageUrl(t.image_url) }}
                  className={`relative w-16 h-16 rounded-lg border overflow-hidden ${isActive ? 'border-white/60 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]' : 'border-white/10 hover:border-white/20'}`}
                  style={{ backgroundColor: isPng(t.image_url) ? (selectedColorHex || t.background_color || 'transparent') : 'transparent' }}
                  title={normPlacement(t.placement).label}
                >
                  <Image src={t.image_url} alt="thumb" fill sizes="64px" className="object-cover" />
                </button>
              )
            })}
          </div>

          {/* Main image */}
          <div
            className="relative w-full rounded-xl overflow-hidden border border-white/10"
            style={{
              aspectRatio: (imgDims?.w && imgDims?.h) ? `${imgDims.w} / ${imgDims.h}` : undefined,
              // Use selected color for letterbox areas for ALL asset types; for transparent PNGs it will also color the garment
              backgroundColor: imgDims ? (preferredBgColor || 'transparent') : 'transparent',
              backgroundImage: bgImageUrl ? `url(${bgImageUrl})` : undefined,
              backgroundSize: bgImageUrl ? 'cover' : undefined,
              backgroundPosition: bgImageUrl ? 'center' : undefined,
              backgroundRepeat: bgImageUrl ? 'no-repeat' : undefined,
            }}
          >
            {activeImage ? (
              <Image
                src={activeImage}
                alt={product.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                onLoadingComplete={(img) => {
                  const w = (img as HTMLImageElement).naturalWidth || 0
                  const h = (img as HTMLImageElement).naturalHeight || 0
                  if (w > 0 && h > 0) setImgDims({ w, h })
                }}
              />
            ) : (
              <div className="w-full h-full" />
            )}
            {/* Clean preview without blur/overlays */}
          </div>

          {/* No generating skeletons to keep page clean */}
        </div>

        {/* Thumbnails (mobile) */}
        {thumbs.length > 0 && (
          <div className="md:hidden mt-3 flex gap-2 overflow-x-auto">
            {thumbs.map((t) => {
              if (!t.image_url) return null
              const isActive = (selectedItem?.image_url || activeImage) === t.image_url
              return (
                <button
                  key={`${normUrl(t.image_url)}|${normPlacement(t.placement).key}`}
                  onClick={() => { setSelectedImageUrl(t.image_url) }}
                  className={`relative flex-none w-16 h-16 rounded-lg border overflow-hidden ${isActive ? 'border-white/60 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]' : 'border-white/10 hover:border-white/20'}`}
                  style={{ backgroundColor: isPng(t.image_url) ? (selectedColorHex || t.background_color || 'transparent') : 'transparent' }}
                  title={normPlacement(t.placement).label}
                >
                  <Image src={t.image_url} alt="thumb" fill sizes="64px" className="object-cover" />
                </button>
              )
            })}
          </div>
        )}

        {/* Placement */}
        {plImages.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-white/60 mb-2">Placement</div>
            <div className="flex flex-wrap gap-2">
              {plImages.map((it) => {
                const { key, label } = normPlacement(it.placement)
                const active = placement === key
                // Debug key list once
                if (typeof window !== 'undefined') {
                  console.debug('[placement]', { keys: plImages.map((x) => normPlacement(x.placement).key) })
                }
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedImageUrl(null); setPlacement(key) }}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${active ? 'border-amber-400/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.04]'}`}
                  >{label}</button>
                )
              })}
            </div>
          </div>
        )}

        {/* Background assist removed per UX feedback */}

        {/* Colors */}
        {colors.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-white/60 mb-2">Color</div>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => {
                const isActive = selectedColor === c.name
                const bg = c.code && /^#?[0-9a-fA-F]{3,8}$/.test(c.code) ? (c.code.startsWith('#') ? c.code : `#${c.code}`) : undefined
                return (
                  <button
                    key={c.name}
                    onClick={() => { setSelectedColor(c.name); setSelectedImageUrl(null) }}
                    title={c.name}
                    className={`relative w-8 h-8 rounded-full border ${isActive ? 'border-amber-400/60 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]' : 'border-white/20'} overflow-hidden`}
                    aria-label={c.name}
                  >
                    <span
                      className="absolute inset-0"
                      style={{ background: bg || 'linear-gradient(135deg, rgba(255,255,255,.16), rgba(0,0,0,.16))' }}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Sizes */}
        {sizes.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-white/60 mb-2">Size</div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSize(s)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${selectedSize===s ? 'border-white/40 bg-white/[0.08]' : 'border-white/10 hover:border-white/20 bg-white/[0.04]'}`}
                >{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="mt-6 text-white/70 text-sm leading-relaxed whitespace-pre-line">{product.description}</div>
        )}
      </div>

      {/* Right: pricing + shipping + CTA */}
      <div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
              <div className="text-xs text-white/60 mb-1">Price</div>
              <div className="text-2xl font-semibold">
                {priceLabel ? (
                  <><span>{priceCurrency}</span> <span>{priceLabel}</span></>
                ) : (
                  <span className="inline-block h-4 w-24 bg-white/10 rounded animate-pulse" />
                )}
              </div>
              <div className="text-xs text-white/50 mt-1">Base price incl. first placement where applicable</div>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
              <div className="text-xs text-white/60 mb-3">Estimated delivery to</div>
              
              {/* Country Selector */}
              <CountrySelectorInline value={geoCountry || 'US'} onChange={persistGeo} />
              
              {/* State Selector (for US, CA, AU) */}
              {(geoCountry === 'US' || geoCountry === 'CA' || geoCountry === 'AU') && (
                <div className="mt-3">
                  <select
                    value={regionCode || ''}
                    onChange={(e) => {
                      const newRegion = e.target.value
                      setRegionCode(newRegion)
                      persistGeo(geoCountry, newRegion)
                    }}
                    className="w-full bg-white/[0.06] border border-white/10 hover:border-white/20 rounded-lg px-3 py-2 text-sm text-white/90 transition-colors [&>option]:bg-black [&>option]:text-white"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="">Select {geoCountry === 'US' ? 'State' : geoCountry === 'CA' ? 'Province' : 'State/Territory'}</option>
                    {geoCountry === 'US' && US_STATES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
                    {geoCountry === 'CA' && CA_PROVINCES.map(p => <option key={p.code} value={p.code}>{p.code} - {p.name}</option>)}
                    {geoCountry === 'AU' && AU_STATES.map(a => <option key={a.code} value={a.code}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
              )}
              
              {/* Shipping Cost & ETA */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/60">Shipping cost</div>
                  <div className="text-base font-medium">
                    {shippingAvailable ? (
                      shipLabel ? (<>{shipCurrency} {shipLabel}</>) : (
                        <span className="inline-block h-4 w-20 bg-white/10 rounded animate-pulse" />
                      )
                    ) : (
                      <span className="text-rose-300 text-sm">Unavailable</span>
                    )}
                  </div>
                </div>
                {shipEta && (
                  <div className="text-xs text-white/60 mt-2 text-right">{shipEta}</div>
                )}
              </div>
            </div>

            <button
              onClick={onStartDesigning}
              disabled={!shippingAvailable}
              className="w-full rounded-lg px-5 py-3 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium btn-shimmer disabled:opacity-40 disabled:cursor-not-allowed"
            >Start designing</button>

            <div className="text-xs text-white/50">
              Color: <span className="text-white/80">{selectedColor || '-'}</span> • Size: <span className="text-white/80">{selectedSize || '-'}</span> • Placement: <span className="text-white/80">{placement}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Size guide */}
      <div className="lg:col-span-2 mt-4">
        <details className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
          <summary className="cursor-pointer text-sm text-white/80">Size guide</summary>
          <div className="mt-3 space-y-4">
            {sizeLoading && <div className="text-xs text-white/60">Loading size guide…</div>}
            {!sizeLoading && (!sizeTables || sizeTables.length === 0) && (
              <div className="text-xs text-white/60">Size guide not available for this product.</div>
            )}
            {Array.isArray(sizeTables) && sizeTables.map((tbl, idx) => (
              <div key={idx} className="rounded-lg bg-white/[0.02] border border-white/10 p-3">
                <div className="flex items-start gap-3">
                  {tbl.image_url && (
                    <div className="relative w-28 h-28 rounded-md overflow-hidden border border-white/10 flex-none">
                      <Image src={tbl.image_url} alt={tbl.type} fill sizes="112px" className="object-contain" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-sm text-white/80 capitalize">{tbl.type.replace(/_/g,' ')}</div>
                    {tbl.description && (
                      <div className="prose prose-invert prose-sm max-w-none text-white/70" dangerouslySetInnerHTML={{ __html: tbl.description }} />
                    )}
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-xs text-white/80 border-separate border-spacing-y-1">
                        <thead>
                          <tr>
                            <th className="text-left pr-3 font-medium text-white/70">Measurement ({tbl.unit})</th>
                            {tbl.measurements?.[0]?.values?.map((v) => (
                              <th key={v.size} className="text-left px-2 font-medium text-white/70">{v.size}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tbl.measurements?.map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td className="pr-3 py-1 text-white/80">{row.type_label}</td>
                              {row.values.map((v, cIdx) => (
                                <td key={cIdx} className="px-2 py-1">
                                  {v.value ? (
                                    <span>{v.value}</span>
                                  ) : (
                                    <span>{v.min_value ?? ''}{v.min_value && v.max_value ? '–' : ''}{v.max_value ?? ''}</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
