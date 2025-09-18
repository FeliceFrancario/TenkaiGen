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
      <body className={`${inter.className} min-h-screen bg-tenkai-dark overflow-x-hidden`}>
        <Providers>
          <div className="fixed top-4 right-4 z-50"><AuthHeader /></div>
          {children}
        </Providers>
      </body>
    </html>
  )
}
