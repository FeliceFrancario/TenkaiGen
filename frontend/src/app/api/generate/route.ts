import { NextResponse } from 'next/server'
import { cookies as cookiesAsync } from 'next/headers'
import { createServiceClient } from '@/lib/database'
import { createClient } from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Google Gemini
const GEMINI_API_KEY = process.env.GEMINI_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
const GEMINI_MODEL_ID = 'gemini-3-pro-image-preview'
// Force DIRECT mode to improve responsiveness and reliability (disable batch regardless of env)
const GEMINI_USE_BATCH = false
const GEMINI_BATCH_MODEL_ID = process.env.GEMINI_BATCH_MODEL_ID || 'gemini-2.5-flash-image'

// B2 S3 config
const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: process.env.B2_S3_REGION || 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.B2_S3_SECRET_ACCESS_KEY || '',
  },
})
const B2_BUCKET = process.env.B2_S3_BUCKET || 'dev-test-tenkaigen'
const B2_PREFIX = process.env.B2_S3_PREFIX || 'ai-generated/'

function toDesignOnlyPrompt(base: string, opts?: { style?: string | null; franchise?: string | null }) {
  const style = opts?.style?.trim()
  const franchise = opts?.franchise?.trim()
  // Strip common garment words
  let cleaned = base
    .replace(/\b(hoodie|shirt|t\s*shirt|t-shirt|tee|sweater|jumper|bomber|jacket|cap|hat|beanie|hoodies|sweatshirt|sweatshirts|pullover|zip[- ]?up|crewneck|crew)\b/gi, '')
    .replace(/\b(on|wearing|printed on|mockup|model|man|woman|male|female|unisex)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const directives = [
    'Create a single, centered graphic design only.',
    'Plain white background. High contrast between subject and background.',
    'No garment, no mockup, no people.',
    'High detail, crisp edges, print-ready.',
  ]
  if (style) directives.unshift(`${style} style.`)
  if (franchise) directives.unshift(`Inspired by ${franchise}.`)

  return `${cleaned}\n${directives.join(' ')}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      prompt,
      expandedPrompt,
      style,
      franchise,
      width = 1024,
      height = 1280,
      seed,
      variants: variantsFromBody
    } = body
    
    console.log('[api/generate] received', { 
      promptLen: prompt?.length,
      expandedPromptLen: expandedPrompt?.length,
      style,
      franchise,
      width,
      height
    })

    if (!prompt && !expandedPrompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Get authenticated user (allow anonymous in dev when ALLOW_ANON_GENERATION=1)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    const allowAnon = String(process.env.ALLOW_ANON_GENERATION || '0').toLowerCase() === '1'
    if ((authError || !user) && !allowAnon) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Create job record in database
    const serviceClient = await createServiceClient()
    // Anonymous session binding (for non-auth users): sticky client token
    const cookieStore = await cookiesAsync()
    let clientToken = cookieStore.get('tg_client')?.value
    if (!clientToken) {
      clientToken = crypto.randomUUID()
      cookieStore.set('tg_client', clientToken, {
        httpOnly: false,
        sameSite: 'lax',
        secure: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 90, // 90 days
      })
    }
    const { data: job, error: jobError } = await serviceClient
      .from('generation_jobs')
      .insert({
        user_id: user?.id || null,
        prompt: prompt || expandedPrompt,
        expanded_prompt: expandedPrompt || prompt,
        style: style || null,
        franchise: franchise || null,
        width,
        height,
        seed,
        status: 'queued',
        metadata: {
          client_token: clientToken,
        } as any,
      })
      .select()
      .single()

    if (jobError || !job) {
      console.error('[api/generate] Failed to create job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create generation job' },
        { status: 500 }
      )
    }

    console.log(`[api/generate] Created job ${job.id}`)

    // Compose design-only prompt (prefer expanded)
    const basePrompt = (expandedPrompt || prompt || '').trim()
    const promptText = toDesignOnlyPrompt(basePrompt, { style, franchise })

    // Compute aspect ratio snapped to allowed set per Gemini docs
    function pickAllowedAspectRatio(w: number, h: number) {
      const allowed = ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9']
      const toFloat = (s: string) => {
        const [a, b] = s.split(':').map(Number)
        return a / b
      }
      const target = w / h
      let best = allowed[0]
      let bestDiff = Math.abs(target - toFloat(best))
      for (const ar of allowed.slice(1)) {
        const diff = Math.abs(target - toFloat(ar))
        if (diff < bestDiff) {
          best = ar
          bestDiff = diff
        }
      }
      return best
    }
    const aspectRatio = pickAllowedAspectRatio(width, height)

    const genOnce = async () => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY!)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
          // Request image output; control aspect via imageConfig
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio },
          } as any,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Gemini request failed: ${res.status} ${text}`)
      }
      const json = await res.json()
      // Extract first inline image from response
      const candidates = json?.candidates || []
      for (const c of candidates) {
        const parts = c?.content?.parts || []
        for (const p of parts) {
          const data = p?.inlineData?.data
          const mime = p?.inlineData?.mimeType || 'image/png'
          if (data && typeof data === 'string') {
            return { data: data as string, mime: String(mime) }
          }
        }
      }
      throw new Error('No image returned from Gemini')
    }

    // If batch mode enabled, submit a batch job (cheaper but async)
    if (GEMINI_USE_BATCH) {
      // Prefer client-provided variants (from parse-prompt) if present, else derive 3 locally
      const base = promptText
      const variants = Array.isArray(variantsFromBody) && variantsFromBody.length >= 1
        ? (variantsFromBody as string[]).slice(0, 3)
        : [
            `${base}\nHigh-detail artistic illustration, intricate shading, professional poster quality.`,
            `${base}\nMinimalist vector logo, bold shapes, clean lines, high contrast.`,
            `${base}\nWatercolor hand-painted look, soft textures, artistic brush strokes.`,
          ]

      // Fallback: File-based batch (JSONL upload)
      // Build JSONL content per docs for File-based batch
      // https://ai.google.dev/gemini-api/docs/image-generation?batch=file
      const lines = variants.map((text, i) =>
        JSON.stringify({
          key: `request-${i + 1}`,
          request: {
            contents: [{ parts: [{ text }] }],
            generation_config: {
              responseModalities: ['IMAGE'],
            },
          },
        })
      )
      const jsonl = lines.join('\n')

      try {
        // Prefer resumable upload per File API docs
        const bytes = Buffer.byteLength(jsonl)
        const startUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files:upload`
        const startRes = await fetch(startUrl, {
          method: 'POST',
          headers: {
            'x-goog-api-key': GEMINI_API_KEY!,
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Content-Type': 'application/x-ndjson',
            'X-Goog-Upload-Content-Length': String(bytes),
            'X-Goog-Upload-File-Name': `batch-${job.id}.jsonl`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({}),
        })
        let fileName: string | null = null
        if (startRes.ok) {
          const uploadUrl = startRes.headers.get('X-Goog-Upload-URL') || startRes.headers.get('x-goog-upload-url')
          if (uploadUrl) {
            const finalizeRes = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'Content-Length': String(bytes),
                'X-Goog-Upload-Offset': '0',
                'X-Goog-Upload-Command': 'upload, finalize',
                'Content-Type': 'application/x-ndjson',
              },
              body: jsonl,
            })
            if (finalizeRes.ok) {
              const info = await finalizeRes.json().catch(() => ({} as any))
              fileName = (info?.name || info?.file?.name || info?.file?.uri || info?.uri || null)
            }
          }
        }

        // Fallback to simple raw upload if resumable failed
        if (!fileName) {
          const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files`
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'x-goog-api-key': GEMINI_API_KEY!,
              'X-Goog-Upload-Protocol': 'raw',
              'Content-Type': 'application/x-ndjson',
              'X-Goog-Upload-File-Name': `batch-${job.id}.jsonl`,
            },
            body: jsonl,
          })
          if (!uploadRes.ok) {
            const t = await uploadRes.text().catch(() => '')
            throw new Error(`Files upload failed: ${uploadRes.status} ${t}`)
          }
          const uploaded = await uploadRes.json().catch(() => ({} as any))
          fileName = (uploaded?.name || uploaded?.file?.name || uploaded?.file?.uri || uploaded?.uri || null)
        }

        if (!fileName) throw new Error('Files upload missing name')

        // 2) Create batch job
        const batchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_BATCH_MODEL_ID}:batchGenerateContent`
        const batchRes = await fetch(batchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
          body: JSON.stringify({
            batch: {
              display_name: `tenkaigen-batch-${job.id}`,
              input_config: { file_name: fileName },
            },
          }),
        })
        if (!batchRes.ok) {
          const t = await batchRes.text().catch(() => '')
          throw new Error(`Batch create failed: ${batchRes.status} ${t}`)
        }
        const batchJson = await batchRes.json()
        const opName = batchJson?.name

        // 3) Save operation for polling via status endpoint
        await serviceClient
          .from('generation_jobs')
          .update({
            status: 'processing',
            metadata: {
              ...(job.metadata || {}),
              provider: 'gemini_batch',
              model: GEMINI_MODEL_ID,
              submitted_at: new Date().toISOString(),
              operation: opName || null,
              src_file: fileName,
              variants,
              aspectRatio,
            } as any,
            started_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        return NextResponse.json({
          jobId: job.id,
          status: 'processing',
          provider: 'gemini_batch',
        })
      } catch (e: any) {
        console.warn('[api/generate] Batch submit failed:', e?.message)
        // Mark as failed so UI can stop banner
        await serviceClient
          .from('generation_jobs')
          .update({
            status: 'failed',
            error_message: 'Batch submission failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id)
        return NextResponse.json({ error: 'Batch submission failed' }, { status: 503 })
      }
    }

    // Direct mode: sequential generation with incremental DB updates for dynamic UI
    // Mark as processing so the UI can start polling and display partials
    await serviceClient
      .from('generation_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        metadata: {
          ...(job.metadata || {}),
          provider: 'gemini_direct',
          model: GEMINI_MODEL_ID,
          extra_urls: [],
        } as any,
      })
      .eq('id', job.id)

    async function genOnceWithPrompt(text: string) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY!)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }]}],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio },
          } as any,
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Gemini request failed: ${res.status} ${text}`)
      }
      const json = await res.json()
      const candidates = json?.candidates || []
      for (const c of candidates) {
        const parts = c?.content?.parts || []
        for (const p of parts) {
          const data = p?.inlineData?.data
          const mime = p?.inlineData?.mimeType || 'image/png'
          if (data && typeof data === 'string') {
            return { data: data as string, mime: String(mime) }
          }
        }
      }
      throw new Error('No image returned from Gemini')
    }

    async function genOnceWithPromptRetry(text: string) {
      const maxAttempts = 3
      let attempt = 0
      let lastErr: any = null
      while (attempt < maxAttempts) {
        try {
          return await genOnceWithPrompt(text)
        } catch (e: any) {
          lastErr = e
          const msg = String(e?.message || '')
          // Retry on transient conditions
          if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429')) {
            const delayMs = Math.min(4000, 500 * Math.pow(2, attempt))
            await new Promise((r) => setTimeout(r, delayMs))
            attempt += 1
            continue
          }
          break
        }
      }
      throw lastErr || new Error('Gemini generation failed')
    }

    try {
      const base = promptText
      const variants = Array.isArray(variantsFromBody) && variantsFromBody.length >= 1
        ? (variantsFromBody as string[]).slice(0, 3)
        : [
            `${base}\nHigh-detail artistic illustration.`,
            `${base}\nMinimalist vector logo, clean lines.`,
            `${base}\nWatercolor hand-painted effect.`,
          ]
      const urls: string[] = []
      for (let i = 0; i < variants.length; i++) {
        const out = await genOnceWithPromptRetry(variants[i])
        const img64 = out.data
        const mime = out.mime || 'image/png'
        const buf = Buffer.from(img64, 'base64')
        const ownerKey = (user?.id as string) || (clientToken as string)
        const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png'
        const key = `${B2_PREFIX}${ownerKey}/${job.id}_${i}.${ext}`
        await s3Client.send(new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: key,
          Body: buf,
          ContentType: mime,
          CacheControl: 'public, max-age=31536000',
        }))
        const url = `${process.env.B2_S3_ENDPOINT}/${B2_BUCKET}/${key}`
        urls.push(url)
        // Update DB incrementally
        const update: any = {
          metadata: {
            ...(job.metadata || {}),
            provider: 'gemini_direct',
            model: GEMINI_MODEL_ID,
            extra_urls: i === 0 ? [] : urls.slice(1),
          },
        }
        if (i === 0) {
          update.result_url = url
        }
        await serviceClient.from('generation_jobs').update(update).eq('id', job.id)
      }
      // Finalize
      await serviceClient
        .from('generation_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      return NextResponse.json({
        jobId: job.id,
        status: 'completed',
        result_url: urls[0] || null,
        extra_urls: urls.slice(1),
      })
    } catch (e: any) {
      console.error('[api/generate] direct mode failed during incremental updates:', e)
      await serviceClient
        .from('generation_jobs')
        .update({
          status: 'failed',
          error_message: e?.message || 'Generation failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

  } catch (e) {
    console.error('[api/generate] error', e)
    return NextResponse.json(
      { error: 'Failed to queue generation' },
      { status: 500 }
    )
  }
}
