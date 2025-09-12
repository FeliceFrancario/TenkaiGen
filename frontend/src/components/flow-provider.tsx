'use client'

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react'

export type FlowContextValue = {
  productSlug?: string
  productName?: string
  variant?: string
  style?: string
  prompt?: string
  franchise?: string
  expandedPrompt?: string
  shortcutMode: boolean
  isGenerating: boolean
  setProduct: (slug: string, name: string) => void
  setVariant: (v: string) => void
  setStyle: (s: string) => void
  setPrompt: (p: string) => void
  setFranchise: (f: string | undefined) => void
  setExpandedPrompt: (p: string | undefined) => void
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
  const [color, setColorState] = useState<string | undefined>()
  const [printArea, setPrintAreaState] = useState<'Front' | 'Back' | undefined>()
  const [size, setSizeState] = useState<string | undefined>()
  const [shortcutMode, setShortcutMode] = useState(false)
  const [isGenerating, setGenerating] = useState(false)
  const [designUrl, setDesignUrlState] = useState<string | undefined>()
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

  const setProduct = (slug: string, name: string) => {
    setProductSlug(slug)
    setProductName(name)
  }

  const setPrompt = (p: string) => setPromptState(p)
  const setFranchise = (f: string | undefined) => setFranchiseState(f)
  const setExpandedPrompt = (p: string | undefined) => setExpandedPromptState(p)
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
    setColorState(undefined)
    setPrintAreaState(undefined)
    setSizeState(undefined)
    setShortcutMode(false)
    setGenerating(false)
    setDesignUrlState(undefined)
    setDesignTransformState(undefined)
  }

  const value = useMemo(
    () => ({ productSlug, productName, variant, style, prompt, franchise, expandedPrompt, shortcutMode, isGenerating, setProduct, setVariant, setStyle, setPrompt, setFranchise, setExpandedPrompt, color, setColor, printArea, setPrintArea, size, setSize, setShortcutMode, setGenerating, designUrl, setDesignUrl: setDesignUrlState, designTransform, setDesignTransform: setDesignTransformState, reset }),
    [productSlug, productName, variant, style, prompt, franchise, expandedPrompt, color, printArea, size, shortcutMode, isGenerating, designUrl, designTransform]
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

