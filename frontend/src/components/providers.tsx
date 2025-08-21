'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import { FlowProvider } from '@/components/flow-provider'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <FlowProvider>
        {children}
      </FlowProvider>
    </SessionProvider>
  )
}
