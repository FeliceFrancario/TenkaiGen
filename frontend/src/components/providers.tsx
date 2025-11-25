'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode, useEffect, useState } from 'react'
import { FlowProvider, useFlow } from '@/components/flow-provider'
import { usePathname } from 'next/navigation'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <FlowProvider>
        <GeneratingBanner />
        {children}
      </FlowProvider>
    </SessionProvider>
  )
}

function GeneratingBanner() {
  const pathname = usePathname()
  const { isGenerating, prompt, shortcutMode, expandedPrompt, lastJobId, latestGeneratedUrls, setGenerating } = useFlow()
  const inBackgroundParse = shortcutMode && !!(prompt && prompt.trim()) && !expandedPrompt
  const shouldShow = (isGenerating || inBackgroundParse)
  const urlsCount = latestGeneratedUrls?.length || 0

  // Completion toast
  const [showToast, setShowToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // Fallback: when we have 3 images, stop the banner and show toast
  useEffect(() => {
    if (isGenerating && urlsCount >= 3) {
      setGenerating(false)
      setToastMsg('Designs ready (3/3)')
      setShowToast(true)
      const t = setTimeout(() => setShowToast(false), 3500)
      return () => clearTimeout(t)
    }
  }, [isGenerating, urlsCount, setGenerating])

  // Safety timeout: auto-stop after 2 minutes if nothing arrives
  useEffect(() => {
    if (!isGenerating) return
    const t = setTimeout(() => {
      setGenerating(false)
      setToastMsg('Generation timed out — please retry')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3500)
    }, 120000)
    return () => clearTimeout(t)
  }, [isGenerating, setGenerating])

  const snippet = (prompt || '').trim().slice(0, 80)
  const onCatalog = pathname?.startsWith('/catalog') || pathname?.startsWith('/categories')
  const progressText = urlsCount > 0 ? ` (${Math.min(urlsCount,3)}/3)` : ''
  const nearReady = urlsCount === 2

  // Plain computed secondary text to avoid conditional hook order changes
  const secondary = inBackgroundParse
    ? 'Parsing prompt…'
    : nearReady
      ? (onCatalog ? 'Almost ready — select a product while you wait' : 'Almost ready…')
      : (onCatalog ? 'Select a product while designs generate in the background' : undefined)

  if (!shouldShow) return (
    <>
      {showToast ? (
        <div className="fixed top-16 right-4 z-[61]">
          <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-50 px-4 py-2 shadow-lg">
            {toastMsg}
          </div>
        </div>
      ) : null}
    </>
  )

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <div className="mx-auto max-w-7xl px-4 py-2">
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-rose-500/20 backdrop-blur supports-[backdrop-filter]:bg-amber-500/15 shadow-[0_10px_30px_rgba(212,175,55,0.15)]">
            <span className="ml-3 inline-block w-4 h-4 rounded-full border-2 border-amber-200/60 border-t-white animate-spin" aria-hidden />
            <div className="py-2 pr-3 text-sm text-amber-100/90">
              <span className="font-medium">Generating{progressText}</span>
              {snippet ? (
                <span className="ml-2 text-amber-50/90">“{snippet}{snippet.length === 80 ? '…' : ''}”</span>
              ) : null}
              {secondary ? (
                <span className="ml-3 text-amber-100/80">{secondary}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {showToast ? (
        <div className="fixed top-16 right-4 z-[61]">
          <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-50 px-4 py-2 shadow-lg">
            {toastMsg}
          </div>
        </div>
      ) : null}
    </>
  )
}
