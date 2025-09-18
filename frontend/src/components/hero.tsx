'use client'

import { useState, useRef, useEffect } from 'react'
import { FiX } from 'react-icons/fi'
import { GiMagicBroom } from 'react-icons/gi'
import { FaImage } from "react-icons/fa6";
import { SparklesCore } from '@/components/ui/sparkles'
import { useRouter } from 'next/navigation'
import { useFlow } from '@/components/flow-provider'

export function Hero() {
  const [prompt, setPrompt] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { setPrompt: setFlowPrompt, setShortcutMode, setGenerating, setProduct, setStyle, setFranchise, setExpandedPrompt } = useFlow()

  // Typewriter headline
  const phrases = [
    'Design a cyberpunk hoodie with neon koi',
    'Minimalist line-art fox tee in silver',
    'Crimson sakura bomber jacket',
    'Geometric gold foil tote bag',
  ]
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = phrases[phraseIndex]
    const speed = deleting ? 35 : 55
    const timer = setTimeout(() => {
      if (!deleting) {
        const next = current.slice(0, typed.length + 1)
        setTyped(next)
        if (next === current) setTimeout(() => setDeleting(true), 1200)
      } else {
        const next = current.slice(0, typed.length - 1)
        setTyped(next)
        if (next.length === 0) {
          setDeleting(false)
          setPhraseIndex((i) => (i + 1) % phrases.length)
        }
      }
    }, speed)
    return () => clearTimeout(timer)
  }, [typed, deleting, phraseIndex])

  const onAttachClick = () => {
    fileInputRef.current?.click()
  }

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) {
      // Only accept images (png, jpg/jpeg)
      const imageFiles = files.filter((f) => /image\/(png|jpe?g)/i.test(f.type))
      setAttachments((prev) => [...prev, ...imageFiles])
    }
    // reset input so selecting the same file again triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const onSend = async () => {
    if (!prompt.trim() && attachments.length === 0) return
    // Start shortcut flow: we parse the prompt to guess a product and begin generating
    try {
      setFlowPrompt(prompt.trim())
      setShortcutMode(true)
      setGenerating(true)
      setExpandedPrompt(undefined)
      setFranchise(undefined)
      console.debug('[hero] onSend start', { prompt: prompt.trim(), attachments: attachments.length })
      // Navigate immediately; parsing runs in background
      router.push('/catalog')

      ;(async () => {
        try {
          const res = await fetch('/api/parse-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
          })
          if (!res.ok) {
            console.warn('[hero] parse-prompt non-OK', { status: res.status })
            return
          }
          const data: { productSlug?: string | null; productName?: string | null; expandedPrompt?: string; suggestedStyle?: string | null; franchise?: string | null } = await res.json()
          console.debug('[hero] parse-prompt JSON (bg)', data)
          if (data.expandedPrompt) setExpandedPrompt(data.expandedPrompt)
          if (data.franchise) setFranchise(data.franchise)
          else setFranchise(undefined)
          if (data.suggestedStyle) setStyle(data.suggestedStyle)
          if (data.productSlug && data.productName) setProduct(data.productSlug, data.productName)
        } catch (e) {
          console.error('[hero] parse-prompt bg error', e)
        } finally {
          // Parsing complete; keep banner visible a bit longer to survive navigation/paint
          setTimeout(() => setGenerating(false), 3000)
        }
      })()
    } catch (e) {
      console.error('[hero] onSend error', e)
      // Already navigating; nothing else to do
    }
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <section className="pt-24 sm:pt-28 pb-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="relative max-w-5xl mx-auto text-center space-y-4 fade-in-up">
        <h1 className="relative z-10 text-4xl md:text-6xl font-semibold tracking-tight text-white">
          {typed}
          <span className="inline-block w-1.5 h-8 md:h-10 align-middle bg-white/70 ml-1 animate-pulse" />
        </h1>
        {/* Decorative band under the heading */}
        <div className="relative w-full max-w-3xl h-20 mx-auto">
          {/* Gradient lines (gold/crimson) above particles */}
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-tenkai-gold to-transparent h-[2px] w-3/4 blur-sm z-10" />
          <div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-tenkai-gold to-transparent h-px w-3/4 z-10" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-red-500 to-transparent h-[5px] w-1/4 blur-sm z-10" />
          <div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-red-500 to-transparent h-px w-1/4 z-10" />

          {/* Particles below the lines */}
          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={200}
            className="absolute inset-0 w-full h-full z-0 pointer-events-none"
            particleColor="#D4AF37"
            speed={0.3}
          />
        </div>
        <p className="relative z-10 text-sm md:text-base text-white/70">Start with a prompt or choose a product first — your design, your flow.</p>
      </div>

      {/* Expanded background sparkles between headline and input */}
      <div className="pointer-events-none absolute inset-x-0 top-40 md:top-44 h-[260px] -z-10">
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1.1}
          particleDensity={200}
          className="w-full h-full"
          particleColor="#D4AF37"
          speed={0.35}
        />
      </div>

      {/* Input Section */}
      <div className="max-w-3xl mx-auto mt-6 fade-in-up" style={{ animationDelay: '80ms' }}>
        {/* Chat-like Input - single inline row */}
        <div className="relative rounded-2xl bg-white/[0.05] backdrop-blur-xl transition-all border border-white/15 hover:border-tenkai-gold/30 hover:ring-1 hover:ring-tenkai-gold/15 focus-within:border-tenkai-gold/40 focus-within:ring-1 focus-within:ring-tenkai-gold/25 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
          <div className="flex items-center gap-2 px-2 py-2">
            <button
              type="button"
              onClick={onAttachClick}
              className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Attach image"
            >
              <FaImage className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={onFilesSelected}
              className="hidden"
            />

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Describe your design idea"
              className="flex-1 min-h-[44px] max-h-40 bg-transparent text-sm placeholder:text-white/45 text-white border-0 outline-none focus:outline-none focus:ring-0 ring-0 resize-none px-2 py-2 rounded-none"
            />

            <button
              type="button"
              onClick={onSend}
              disabled={!prompt.trim() && attachments.length === 0}
              className="ml-2 btn-shimmer inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-tenkai-gold via-tenkai-gold/50 to-red-500/50 text-white hover:from-tenkai-gold/30 hover:to-red-500/30 shadow-[0_8px_30px_rgba(212,175,55,0.12)]"
            >
              <GiMagicBroom className="w-4 h-4" />
              <span className="text-lg font-semibold">Create</span>
            </button>
          </div>
        </div>

        {/* Removed inline generating indicator on homepage to avoid perceived lag; generation runs in background */}

        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 fade-in-up" style={{ animationDelay: '160ms' }}>
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-white/[0.06] border border-white/10 text-white/80 rounded-lg px-3 py-1.5 text-xs shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
              >
                <span className="truncate max-w-[200px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="text-white/50 hover:text-white"
                  aria-label="Remove attachment"
                >
                  <FiX className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
