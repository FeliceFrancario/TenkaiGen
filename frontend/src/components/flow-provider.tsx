'use client'

import React, { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react'
import { createClient as createBrowserSupabase } from '@/lib/supabase/browser'

export type FlowContextValue = {
  productSlug?: string
  productName?: string
  variant?: string
  style?: string
  prompt?: string
  franchise?: string
  expandedPrompt?: string
  variants?: string[]
  preferredVariant?: string
  shortcutMode: boolean
  isGenerating: boolean
  setProduct: (slug: string, name: string) => void
  setVariant: (v: string) => void
  setStyle: (s: string) => void
  setPrompt: (p: string) => void
  setFranchise: (f: string | undefined) => void
  setExpandedPrompt: (p: string | undefined) => void
  setVariants: (v: string[] | undefined) => void
  setPreferredVariant: (v: string | undefined) => void
  color?: string
  setColor: (c: string | undefined) => void
  printArea?: 'Front' | 'Back'
  setPrintArea: (a: 'Front' | 'Back' | undefined) => void
  size?: string
  setSize: (s: string | undefined) => void
  setShortcutMode: (on: boolean) => void
  setGenerating: (on: boolean) => void
  // Design selection and transform within print area (normalized units 0..1)
  designUrl?: string
  setDesignUrl: (url: string | undefined) => void
  // Per-placement selections
  designsByPlacement: Partial<Record<'front'|'back'|'left'|'right', { url: string; transform?: { x:number;y:number;w:number;h:number;rotationDeg:number } }>>
  setDesignForPlacement: (placement: 'front'|'back'|'left'|'right', data: { url: string; transform?: { x:number;y:number;w:number;h:number;rotationDeg:number } } | undefined) => void
  designTransform?: {
    placement: 'front' | 'back' | 'left' | 'right'
    x: number // left within print area (0..1)
    y: number // top within print area (0..1)
    w: number // width relative to print area (0..1)
    h: number // height relative to print area (0..1)
    rotationDeg: number // degrees
  }
  setDesignTransform: (
    t:
      | {
          placement: 'front' | 'back' | 'left' | 'right'
          x: number
          y: number
          w: number
          h: number
          rotationDeg: number
        }
      | undefined
  ) => void
  reset: () => void
  // Realtime-driven generation stream
  lastJobId?: string
  setLastJobId: (id: string | undefined) => void
  latestGeneratedUrls: string[]
}

const FlowContext = createContext<FlowContextValue | undefined>(undefined)

export function FlowProvider({ children }: { children: ReactNode }) {
  const [productSlug, setProductSlug] = useState<string | undefined>()
  const [productName, setProductName] = useState<string | undefined>()
  const [variant, setVariant] = useState<string | undefined>()
  const [style, setStyle] = useState<string | undefined>()
  const [prompt, setPromptState] = useState<string | undefined>()
  const [franchise, setFranchiseState] = useState<string | undefined>()
  const [expandedPrompt, setExpandedPromptState] = useState<string | undefined>()
  const [variants, setVariantsState] = useState<string[] | undefined>()
  const [preferredVariant, setPreferredVariantState] = useState<string | undefined>()
  const [color, setColorState] = useState<string | undefined>()
  const [printArea, setPrintAreaState] = useState<'Front' | 'Back' | undefined>()
  const [size, setSizeState] = useState<string | undefined>()
  const [shortcutMode, setShortcutMode] = useState(false)
  const [isGenerating, setGenerating] = useState(false)
  const [designUrl, setDesignUrlState] = useState<string | undefined>()
  const [designsByPlacement, setDesignsByPlacement] = useState<Partial<Record<'front'|'back'|'left'|'right', { url: string; transform?: { x:number;y:number;w:number;h:number;rotationDeg:number } }>>>({})
  const setDesignForPlacement = (placement: 'front'|'back'|'left'|'right', data: { url: string; transform?: { x:number;y:number;w:number;h:number;rotationDeg:number } } | undefined) => {
    setDesignsByPlacement((prev) => {
      const next = { ...prev }
      if (data) next[placement] = data
      else delete next[placement]
      return next
    })
  }
  const [designTransform, setDesignTransformState] = useState<
    | {
        placement: 'front' | 'back' | 'left' | 'right'
        x: number
        y: number
        w: number
        h: number
        rotationDeg: number
      }
    | undefined
  >()
  // Realtime-driven generation stream
  const [lastJobId, setLastJobId] = useState<string | undefined>()
  const [latestGeneratedUrls, setLatestGeneratedUrls] = useState<string[]>([])

  // Supabase Realtime subscription for generation updates (user or anon token)
  useEffect(() => {
    const supabase = createBrowserSupabase()
    let unsub: (() => void) | undefined
    let active = true

    const ensureClientToken = () => {
      try {
        const key = 'tg_client='
        const found = typeof document !== 'undefined' ? document.cookie.split('; ').find((c) => c.startsWith(key)) : undefined
        if (found) return found.slice(key.length)
        const token = crypto.randomUUID()
        if (typeof document !== 'undefined') {
          document.cookie = `tg_client=${token}; Path=/; Max-Age=${60 * 60 * 24 * 90}; SameSite=Lax`
        }
        return token
      } catch {
        return undefined
      }
    }

    ;(async () => {
      const clientToken = ensureClientToken()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id

      const channel = supabase
        .channel('gen-jobs')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'generation_jobs' }, (payload: any) => {
          if (!active) return
          const row = payload?.new || payload?.record
          if (!row) return
          // Filter to this user's jobs: logged-in user_id OR anon client_token match
          const rowToken = row?.metadata?.client_token
          if (userId && row?.user_id === userId || (!userId && clientToken && rowToken && rowToken === clientToken)) {
            // Build urls snapshot
            const urls = [row?.result_url, ...((row?.metadata?.extra_urls as string[]) || [])].filter((u: any) => !!u && typeof u === 'string')
            setLastJobId(row.id)
            if (urls.length > 0) setLatestGeneratedUrls(urls)
            if (row?.status === 'completed' || row?.status === 'failed') {
              setGenerating(false)
            }
          }
        })
        .subscribe()

      unsub = () => {
        try { supabase.removeChannel(channel) } catch {}
      }
    })()

    return () => {
      active = false
      if (unsub) unsub()
    }
  }, [])

  const setProduct = (slug: string, name: string) => {
    setProductSlug(slug)
    setProductName(name)
  }

  const setPrompt = (p: string) => setPromptState(p)
  const setFranchise = (f: string | undefined) => setFranchiseState(f)
  const setExpandedPrompt = (p: string | undefined) => setExpandedPromptState(p)
  const setVariants = (v: string[] | undefined) => setVariantsState(v)
  const setPreferredVariant = (v: string | undefined) => setPreferredVariantState(v)
  const setColor = (c: string | undefined) => setColorState(c)
  const setPrintArea = (a: 'Front' | 'Back' | undefined) => setPrintAreaState(a)
  const setSize = (s: string | undefined) => setSizeState(s)

  const reset = () => {
    setProductSlug(undefined)
    setProductName(undefined)
    setVariant(undefined)
    setStyle(undefined)
    setPromptState(undefined)
    setFranchiseState(undefined)
    setExpandedPromptState(undefined)
    setVariantsState(undefined)
    setPreferredVariantState(undefined)
    setColorState(undefined)
    setPrintAreaState(undefined)
    setSizeState(undefined)
    setShortcutMode(false)
    setGenerating(false)
    setDesignUrlState(undefined)
    setDesignsByPlacement({})
    setDesignTransformState(undefined)
  }

  const value = useMemo(
    () => ({ 
      productSlug, productName, variant, style, prompt, franchise, expandedPrompt, variants, preferredVariant,
      shortcutMode, isGenerating, 
      setProduct, setVariant, setStyle, setPrompt, setFranchise, setExpandedPrompt, setVariants, setPreferredVariant,
      color, setColor, 
      printArea, setPrintArea, 
      size, setSize, 
      setShortcutMode, setGenerating, 
      designUrl, setDesignUrl: setDesignUrlState, 
      designsByPlacement, setDesignForPlacement, 
      designTransform, setDesignTransform: setDesignTransformState, 
      reset, 
      lastJobId, setLastJobId, 
      latestGeneratedUrls 
    }),
    [productSlug, productName, variant, style, prompt, franchise, expandedPrompt, variants, preferredVariant, color, printArea, size, shortcutMode, isGenerating, designUrl, designsByPlacement, designTransform, lastJobId, latestGeneratedUrls]
  )

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>
}

export function useFlow() {
  const ctx = useContext(FlowContext)
  if (!ctx) {
    throw new Error('useFlow must be used within a FlowProvider')
  }
  return ctx
}

