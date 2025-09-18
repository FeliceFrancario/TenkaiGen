"use client"

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/browser'

export default function SignInPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const r = params.get('returnUrl')
      setReturnUrl(r)
    } catch {}
  }, [])

  const signInWithEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setStatus(error.message)
    else window.location.href = returnUrl || '/'
  }

  const signInWithEmailLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    const redirectTo = returnUrl ? `${window.location.origin}${returnUrl}` : window.location.origin
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    setStatus(error ? error.message : 'Check your email for the sign-in link')
  }

  const signInWithGoogle = async () => {
    setStatus(null)
    const redirectTo = returnUrl ? `${window.location.origin}${returnUrl}` : window.location.origin
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) setStatus(error.message)
  }

  return (
    <main className="min-h-[60vh] px-6 py-10 max-w-md mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-4">Sign in</h1>

      <form onSubmit={signInWithEmailPassword} className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password" className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm" />
        <button type="submit" className="w-full rounded-lg px-5 py-2.5 bg-white text-black font-medium">Sign in</button>
      </form>

      <div className="my-4 text-center text-white/60 text-sm">or</div>

      <form onSubmit={signInWithEmailLink} className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm" />
        <button type="submit" className="w-full rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium">Send magic link</button>
      </form>

      <div className="my-4 text-center text-white/60 text-sm">or</div>

      <button onClick={signInWithGoogle} className="w-full rounded-lg px-5 py-2.5 bg-[#4285F4] text-white font-medium inline-flex items-center justify-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.676 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.617-3.317-11.283-7.946l-6.563 5.047C9.497 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.12 5.571.001-.001 6.554 5.212 6.554 5.212C40.622 35.778 44 30.333 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
        Continue with Google
      </button>

      {status && <div className="mt-4 text-sm text-white/70">{status}</div>}
    </main>
  )
}
