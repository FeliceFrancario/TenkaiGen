import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TenkaiGen - AI-Powered Print-on-Demand',
  description: 'Generate, customize, and order unique apparel and accessories with AI-assisted designs',
  keywords: 'AI, print-on-demand, custom apparel, design generation, t-shirts, hoodies',
  authors: [{ name: 'TenkaiGen Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-tenkai-dark`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
