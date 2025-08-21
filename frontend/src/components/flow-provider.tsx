'use client'

import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react'

export type FlowContextValue = {
  productSlug?: string
  productName?: string
  variant?: string
  style?: string
  prompt?: string
  franchise?: string
  shortcutMode: boolean
  isGenerating: boolean
  setProduct: (slug: string, name: string) => void
  setVariant: (v: string) => void
  setStyle: (s: string) => void
  setPrompt: (p: string) => void
  setFranchise: (f: string | undefined) => void
  setShortcutMode: (on: boolean) => void
  setGenerating: (on: boolean) => void
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
  const [shortcutMode, setShortcutMode] = useState(false)
  const [isGenerating, setGenerating] = useState(false)

  const setProduct = (slug: string, name: string) => {
    setProductSlug(slug)
    setProductName(name)
  }

  const setPrompt = (p: string) => setPromptState(p)
  const setFranchise = (f: string | undefined) => setFranchiseState(f)

  const reset = () => {
    setProductSlug(undefined)
    setProductName(undefined)
    setVariant(undefined)
    setStyle(undefined)
    setPromptState(undefined)
    setFranchiseState(undefined)
    setShortcutMode(false)
    setGenerating(false)
  }

  const value = useMemo(
    () => ({ productSlug, productName, variant, style, prompt, franchise, shortcutMode, isGenerating, setProduct, setVariant, setStyle, setPrompt, setFranchise, setShortcutMode, setGenerating, reset }),
    [productSlug, productName, variant, style, prompt, franchise, shortcutMode, isGenerating]
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

