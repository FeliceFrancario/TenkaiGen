'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getProductBySlug } from '@/lib/data'
import { useFlow } from '@/components/flow-provider'
import BackHomeBar from '@/components/back-home-bar'
import { STYLES } from '@/lib/styles'

export default function PromptClient({ slug }: { slug: string }) {
  const router = useRouter()
  const { productSlug, productName, variant, style, prompt, expandedPrompt, franchise, color, size, printArea, setPrompt, setStyle, setVariant, isGenerating, setGenerating, shortcutMode, setExpandedPrompt, setFranchise, latestGeneratedUrls, variants, preferredVariant, setPreferredVariant, setDesignUrl } = useFlow()
  const product = getProductBySlug(slug)
  const [value, setValue] = useState<string>(prompt || '')
  const [showVariantPicker, setShowVariantPicker] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [detectingStyle, setDetectingStyle] = useState(false)
  const [jobQueued, setJobQueued] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([])
  const [editingUrl, setEditingUrl] = useState<string | null>(null)
  const [editPrompt, setEditPrompt] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isSubmittingEdit, setSubmittingEdit] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)

  // Merge realtime updates from provider
  useEffect(() => {
    if (latestGeneratedUrls && latestGeneratedUrls.length > 0) {
      setGeneratedUrls(latestGeneratedUrls)
    }
  }, [latestGeneratedUrls])

  // Guards: require variant; if style missing, allow brief detection window then default to Standard
  useEffect(() => {
    if (!product) return
    if (!variant) {
      router.replace(`/product/${product.slug}`)
      return
    }
    if (!style) {
      setDetectingStyle(true)
      const t = setTimeout(() => {
        if (!style) setStyle('Standard')
        setDetectingStyle(false)
      }, 1200)
      return () => clearTimeout(t)
    } else {
      setDetectingStyle(false)
    }
  }, [slug, variant, style])

  // Auto-queue first generation in shortcut flow (or when isGenerating is true)
  useEffect(() => {
    if (!product) return
    if (!variant) return
    if (!isGenerating) return
    if (jobQueued) return
    (async () => {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productSlug: productSlug || product.slug,
            productName: productName || product.name,
            variant,
            style: style || 'Standard',
            color,
            size,
            printArea,
            prompt: value || prompt || '',
            expandedPrompt,
            franchise,
            variants: preferredVariant ? [preferredVariant] : variants,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          console.debug('[prompt] queued generation', data)
          // Direct mode returns completed with URLs
          if (data?.status === 'completed' && (data?.result_url || data?.extra_urls?.length)) {
            const urls = [data.result_url, ...(data.extra_urls || [])].filter(Boolean)
            setGeneratedUrls(urls)
            setGenerating(false)
            setJobQueued(false)
            setJobId(null)
          } else {
            // Batch or deferred: save jobId and start polling
            if (data?.jobId) setJobId(data.jobId)
            setJobQueued(true)
            setPolling(true)
          }
        }
      } catch (e) {
        console.error('[prompt] queue generation error', e)
        setGenError('Failed to start generation')
        setGenerating(false)
      }
    })()
  }, [product, variant, isGenerating])

  // Poll status for batch/deferred jobs
  useEffect(() => {
    if (!polling) return
    if (!isGenerating) return
    if (!jobId) return
    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/status/${jobId}`)
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        // Update partials while processing
        const partial = [json?.result_url, ...(json?.metadata?.extra_urls || [])].filter(Boolean)
        if (partial.length > 0) setGeneratedUrls(partial)
        if (json?.status === 'completed') {
          setGenerating(false)
          setPolling(false)
          setJobQueued(false)
          setJobId(null)
        }
        if (json?.status === 'failed') {
          setGenError(json?.error_message || 'Generation failed')
          setGenerating(false)
          setPolling(false)
          setJobQueued(false)
        }
      } catch {}
    }, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [polling, isGenerating, jobId])

  const onAddToProduct = (url: string) => {
    setDesignUrl(url)
  }

  const onEditImage = (url: string) => {
    setEditingUrl(url)
    setEditPrompt('')
    setEditError(null)
    setIsEditing(true)
  }

  const onDeleteImage = async (url: string) => {
    try {
      const res = await fetch('/api/designs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      if (res.ok) {
        setGeneratedUrls((prev) => prev.filter((x) => x !== url))
      }
    } catch {}
  }

  const onSetPreferred = (index: number) => {
    if (!variants || variants.length < index + 1) return
    setPreferredVariant(variants[index])
  }

  const submitEdit = async () => {
    if (!editingUrl || !editPrompt.trim()) return
    try {
      setSubmittingEdit(true)
      setEditError(null)
      // fetch image and convert to base64
      const resp = await fetch(editingUrl, { cache: 'no-store' })
      const blob = await resp.blob()
      const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1] || '')
        r.onerror = (e) => reject(e)
        r.readAsDataURL(b)
      })
      const data64 = await toBase64(blob)
      const res = await fetch('/api/generate/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data64, prompt: editPrompt.trim() })
      })
      if (!res.ok) throw new Error('Edit failed')
      const out = await res.json()
      const newUrl = out?.result_url
      if (newUrl) {
        setGeneratedUrls((prev) => [newUrl, ...prev])
      }
      setIsEditing(false)
      setEditingUrl(null)
      setEditPrompt('')
    } catch (e: any) {
      setEditError(e?.message || 'Edit failed')
    } finally {
      setSubmittingEdit(false)
    }
  }

  if (!product) {
    return (
      <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
        <BackHomeBar />
        <h1 className="text-2xl font-semibold mb-4">Product not found</h1>
        <Link href="/categories" className="text-white/70 hover:text-white underline">
          Back to categories
        </Link>
      </main>
    )
  }

  const handleGenerate = async () => {
    const p = value.trim()
    if (!p) return
    setPrompt(p)
    if (!isGenerating) setGenerating(true)
    try {
      // Clear stale franchise before parsing anew
      setFranchise(undefined)
      const res = await fetch('/api/parse-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: p }),
      })
      if (res.ok) {
        const data: { expandedPrompt?: string; franchise?: string | null; suggestedStyle?: string | null } = await res.json()
        if (data.expandedPrompt) setExpandedPrompt(data.expandedPrompt)
        if (data.franchise) setFranchise(data.franchise)
        else setFranchise(undefined)
        // Respect manual selection; only set style if none chosen
        if (!style && data.suggestedStyle) setStyle(data.suggestedStyle)
      }
      // TODO: Kick off image generation with current selections and expandedPrompt
    } catch (e) {
      console.error('[prompt] parse-prompt error', e)
    }
  }

  return (
    <main className="min-h-[60vh] px-6 py-16 max-w-5xl mx-auto text-white">
      <BackHomeBar />
      {(shortcutMode || isGenerating) && (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-200">
          <div className="text-sm">
            Generating designs for: <span className="font-medium text-amber-100">{(value || prompt || '').slice(0, 120) || 'your prompt'}</span>
            {isGenerating && !jobQueued && <span className="ml-2 text-amber-300">(setting up…)</span>}
            {isGenerating && jobQueued && <span className="ml-2 text-amber-300">{polling ? '(processing…)' : '(queued…)'}</span>}
          </div>
        </div>
      )}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">{productName || product.name} • Prompt</h1>
        <p className="text-white/60 mt-1">Describe what you want to create. Keep it concise and visual.</p>
      </div>

      {/* Collapsible controls for variant and style */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/70">
        <div className="rounded-lg border border-white/10 bg-white/[0.04]">
          <button
            onClick={() => setShowVariantPicker((s) => !s)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/[0.06] rounded-lg"
          >
            <div>
              <div className="text-white/50">Variant</div>
              <div className="text-white">{variant || 'Select variant'}</div>
            </div>
            <span className={`transition-transform ${showVariantPicker ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {showVariantPicker && (
            <div className="p-3 pt-0">
              <div className="flex flex-wrap gap-2">
                {(product.variants || []).map((v) => (
                  <button
                    key={v}
                    onClick={() => { setVariant(v); setShowVariantPicker(false) }}
                    className={`px-3 py-1.5 rounded-lg border ${variant===v ? 'border-amber-400/40 bg-white/[0.08] text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.04] text-white/80'}`}
                  >{v}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04]">
          <button
            onClick={() => setShowStylePicker((s) => !s)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/[0.06] rounded-lg"
          >
            <div>
              <div className="text-white/50 flex items-center gap-2">Style {detectingStyle && !style && <span className="text-amber-300 text-xs">Detecting…</span>}</div>
              <div className="text-white">{style || 'Select style'}</div>
            </div>
            <span className={`transition-transform ${showStylePicker ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {showStylePicker && (
            <div className="p-3 pt-0">
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStyle(s); setShowStylePicker(false) }}
                    className={`px-3 py-1.5 rounded-lg border ${style===s ? 'border-amber-400/40 bg-white/[0.08] text-white' : 'border-white/10 hover:border-white/20 bg-white/[0.04] text-white/80'}`}
                  >{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g., Crimson and gold phoenix in minimalist line art, centered composition"
          rows={5}
          className="w-full resize-none bg-transparent outline-none placeholder:text-white/40 text-white"
        />
        <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 hover:opacity-100 transition-opacity btn-shimmer" />
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={!value.trim()}
          className="rounded-lg px-5 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed btn-shimmer"
        >
          {isGenerating ? 'Generating…' : 'Generate'}
        </button>
        {shortcutMode ? (
          <Link
            href={`/product/${product.slug}`}
            className="rounded-lg px-5 py-2.5 border border-white/15 text-white/80 hover:text-white hover:border-white/30"
          >
            Back
          </Link>
        ) : (
          <Link
            href={`/product/${product.slug}/style`}
            className="rounded-lg px-5 py-2.5 border border-white/15 text-white/80 hover:text-white hover:border-white/30"
          >
            Back
          </Link>
        )}
      </div>

      {(isGenerating || generatedUrls.length > 0 || genError) && (
        <div className="mt-8">
          <div className="text-white/70 text-sm mb-3">
            {genError ? (
              <span className="text-rose-300">{genError}</span>
            ) : generatedUrls.length > 0 ? (
              'Your variants are ready:'
            ) : (
              'Preview variants will appear here as they complete:'
            )}
          </div>
          {generatedUrls.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedUrls.slice(0, 6).map((u, i) => (
                <div
                  key={i}
                  className="relative group aspect-[4/5] rounded-lg border border-white/10 bg-white/[0.04] overflow-hidden"
                  onClick={() => onAddToProduct(u)}
                  role="button"
                  aria-label="Use design"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Variant ${i+1}`} className="w-full h-full object-contain" style={{ backgroundColor: 'transparent' }} />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="rounded-full bg-white/92 text-black backdrop-blur-md ring-1 ring-black/10 px-3 py-2 flex items-center gap-3 pointer-events-auto shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                      <button onClick={(e) => { e.stopPropagation(); onAddToProduct(u) }} className="p-2 rounded-md hover:bg-white" title="Add to product" aria-label="Add to product">
                        <Plus className="w-6 h-6" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onEditImage(u) }} className="p-2 rounded-md hover:bg-white" title="Edit" aria-label="Edit">
                        <Pencil className="w-6 h-6" />
                      </button>
                      <button onClick={async (e) => { e.stopPropagation(); await onDeleteImage(u) }} className="p-2 rounded-md hover:bg-white" title="Delete" aria-label="Delete">
                        <Trash2 className="w-6 h-6" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onSetPreferred(i) }} className={`px-2 py-1 text-[11px] rounded ${preferredVariant && variants && variants[i] === preferredVariant ? 'bg-amber-500 text-black' : 'bg-white text-black hover:bg-white/90'}`} title="Prefer this style">
                        {preferredVariant && variants && variants[i] === preferredVariant ? 'Preferred' : 'Prefer'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg border border-white/10 bg-white/[0.06] animate-pulse" />
              ))}
            </div>
          )}
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-[#0b0b0b] text-white overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="font-medium">Edit Image</div>
              <button onClick={() => setIsEditing(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="p-3 border-b md:border-b-0 md:border-r border-white/10">
                {editingUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingUrl} alt="Editing" className="w-full h-[360px] object-contain" />
                )}
              </div>
              <div className="p-3">
                <label className="text-sm text-white/70">Describe the edit</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={8}
                  placeholder="e.g., Increase line contrast and remove stray marks near the edges"
                  className="w-full mt-2 rounded-lg bg-white/[0.04] border border-white/10 p-2 outline-none"
                />
                {editError && <div className="text-rose-300 text-xs mt-2">{editError}</div>}
                <div className="mt-3 flex items-center gap-2">
                  <button disabled={isSubmittingEdit || !editPrompt.trim()} onClick={submitEdit} className="px-3 py-2 rounded bg-blue-500 hover:bg-blue-600 disabled:opacity-50">
                    {isSubmittingEdit ? 'Applying…' : 'Apply edit'}
                  </button>
                  <button onClick={() => setIsEditing(false)} className="px-3 py-2 rounded border border-white/15">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

