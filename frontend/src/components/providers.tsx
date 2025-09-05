'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
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
  const { isGenerating, prompt, shortcutMode, expandedPrompt } = useFlow()
  const pathname = usePathname()
  const onCatalog = typeof pathname === 'string' && pathname.startsWith('/catalog')
  const inBackgroundParse = shortcutMode && !!(prompt && prompt.trim()) && !expandedPrompt
  const shouldShow = onCatalog && (isGenerating || inBackgroundParse)
  if (!shouldShow) return null
  const snippet = (prompt || '').trim().slice(0, 80)
  return (
    <div className="fixed top-0 left-0 right-0 z-[60]">
      <div className="mx-auto max-w-7xl px-4 py-2">
        <div className="flex items-center gap-3 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-rose-500/20 backdrop-blur supports-[backdrop-filter]:bg-amber-500/15 shadow-[0_10px_30px_rgba(212,175,55,0.15)]">
          <span className="ml-3 inline-block w-4 h-4 rounded-full border-2 border-amber-200/60 border-t-white animate-spin" aria-hidden />
          <div className="py-2 pr-3 text-sm text-amber-100/90">
            <span className="font-medium">Generating</span>
            {snippet ? (
              <span className="ml-2 text-amber-50/90">“{snippet}{snippet.length === 80 ? '…' : ''}”</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
