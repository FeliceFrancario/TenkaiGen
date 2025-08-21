'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function BackHomeBar() {
  const router = useRouter()
  return (
    <div className="fixed top-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-2 py-1 shadow-lg">
      <button
        aria-label="Go back"
        onClick={() => router.back()}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </button>
      <div className="h-5 w-px bg-white/10" />
      <Link
        href="/"
        className="rounded-lg px-2 py-1 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
      >
        Home
      </Link>
    </div>
  )
}
