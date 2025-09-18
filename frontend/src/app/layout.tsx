import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { AuthHeader } from '@/components/auth-header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TenkaiGen - AI-Powered Print-on-Demand',
  description: 'Generate, customize, and order unique apparel and accessories with AI-assisted designs',
  keywords: 'AI, print-on-demand, custom apparel, design generation, t-shirts, hoodies',
  authors: [{ name: 'TenkaiGen Team' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-tenkai-dark overflow-x-hidden relative`}>
        {/* Global background gradients (clean Night Blue) */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_20%_-10%,rgba(45,84,94,0.6),transparent),radial-gradient(1000px_520px_at_110%_120%,rgba(18,52,59,0.55),transparent)]" />
        </div>
        <Providers>
          <div className="fixed top-4 right-4 z-50"><AuthHeader /></div>
          {children}
        </Providers>
      </body>
    </html>
  )
}
