import { Hero } from '@/components/hero'
import { ProductShowcase } from '@/components/product-showcase'
import { HowItWorks } from '@/components/how-it-works'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-tenkai-dark relative">
      {/* Top-left placeholder logo */}
      <Link href="/" aria-label="Tenkai Home" className="absolute top-4 left-4 z-20 inline-flex items-center gap-2">
        {/*<span className="h-8 w-8 rounded-xl bg-gradient-to-br from-tenkai-gold to-red-500 shadow-[0_8px_30px_rgba(212,175,55,0.25)]" />*/}
        <span className="text-white/90 font-semibold tracking-wide">TenkaiGen</span>
      </Link>
      {/* Top-right auth header like Suno */}
      <div className="absolute top-4 right-4 z-20 flex gap-3">
        <Link href="/signin" className="px-4 py-2 rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition">Sign In</Link>
        <Link href="/signup" className="px-4 py-2 rounded-full bg-white text-black hover:opacity-90 transition">Sign Up</Link>
      </div>
      <Hero />
      {/* High-quality apparel row (repurposed ProductShowcase) */}
      <ProductShowcase />
      {/* Pricing section (repurposed HowItWorks) */}
      <HowItWorks />
      
      
    </main>
  )
}
