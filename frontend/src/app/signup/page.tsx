"use client"

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

export default function SignUpPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const signUpWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setStatus(error ? error.message : 'Check your email to finish sign-up')
  }

  const signUpWithGoogle = async () => {
    setStatus(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) setStatus(error.message)
  }

  return (
    <main className="min-h-[60vh] px-6 py-10 max-w-md mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-4">Sign up</h1>
      <form onSubmit={signUpWithEmail} className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm" />
        <button type="submit" className="w-full rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium">Send magic link</button>
      </form>
      <div className="my-4 text-center text-white/60 text-sm">or</div>
      <button onClick={signUpWithGoogle} className="w-full rounded-lg px-5 py-2.5 bg-white text-black font-medium">Continue with Google</button>
      {status && <div className="mt-4 text-sm text-white/70">{status}</div>}
    </main>
  )
}
