import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/database'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const GEMINI_API_KEY = process.env.GEMINI_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY

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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
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

    // Fetch job status
    let job: any = null
    let jobError: any = null
    if (user) {
      // Authenticated: rely on RLS to scope to user
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single()
      job = data
      jobError = error
    } else {
      // Anonymous dev mode: use service client (no RLS)
      const svc = await createServiceClient()
      const { data, error } = await svc
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single()
      job = data
      jobError = error
    }

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // If this is a Gemini batch job still processing, try to finalize it now (poll-on-read)
    if (job?.status && (job.status === 'queued' || job.status === 'processing')) {
      const provider = job?.metadata?.provider
      if (provider === 'gemini_batch' && GEMINI_API_KEY) {
        const operation: string | null =
          job?.metadata?.operation || null
        if (operation && typeof operation === 'string') {
          try {
            // Poll batch job state (batches API)
            const opUrl = `https://generativelanguage.googleapis.com/v1beta/${operation}`
            const opRes = await fetch(opUrl, { method: 'GET', headers: { 'x-goog-api-key': GEMINI_API_KEY! } })
            if (opRes.ok) {
              const opJson = await opRes.json()
              const state: string | undefined = opJson?.state
              const isTerminal =
                state === 'JOB_STATE_SUCCEEDED' ||
                state === 'JOB_STATE_FAILED' ||
                state === 'JOB_STATE_CANCELLED' ||
                state === 'JOB_STATE_EXPIRED'

              if (isTerminal) {
                // Case 1: inline responses embedded
                type ImgOut = { data: string; mime: string }
                let images: ImgOut[] = []
                const inlined = opJson?.response?.batches?.[0]?.dest?.inlinedResponses
                if (Array.isArray(inlined) && inlined.length > 0) {
                  for (const r of inlined) {
                    // Find inlineData in any response candidate
                    const scan = (node: any) => {
                      if (!node || typeof node !== 'object') return
                      if (node.inlineData?.data && typeof node.inlineData.data === 'string') {
                        images.push({ data: node.inlineData.data as string, mime: String(node.inlineData?.mimeType || 'image/png') })
                      }
                      for (const v of Object.values(node)) scan(v)
                    }
                    scan(r)
                  }
                }

                // Case 2: result file provided -> download JSONL and parse
                if (images.length === 0 && state === 'JOB_STATE_SUCCEEDED') {
                  const fileName =
                    opJson?.response?.batches?.[0]?.dest?.fileName ||
                    opJson?.dest?.fileName ||
                    null
                  if (fileName && typeof fileName === 'string') {
                    const downloadUrl = `https://generativelanguage.googleapis.com/download/v1beta/${fileName}:download?alt=media`
                    const dlRes = await fetch(downloadUrl, { method: 'GET', headers: { 'x-goog-api-key': GEMINI_API_KEY! } })
                    if (dlRes.ok) {
                      const text = await dlRes.text()
                      // Each line is JSON
                      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
                      for (const line of lines) {
                        try {
                          const obj = JSON.parse(line)
                          const scan = (node: any) => {
                            if (!node || typeof node !== 'object') return
                            if (node.inlineData?.data && typeof node.inlineData.data === 'string') {
                              images.push({ data: node.inlineData.data as string, mime: String(node.inlineData?.mimeType || 'image/png') })
                            }
                            for (const v of Object.values(node)) scan(v)
                          }
                          scan(obj)
                        } catch {}
                      }
                    }
                  }
                }

                if (state === 'JOB_STATE_SUCCEEDED' && images.length > 0) {
                  // Upload first 3 images
                  const userId = job.user_id || 'anon'
                  const urls: string[] = []
                  let idx = 0
                  for (const out of images.slice(0, 3)) {
                    const buf = Buffer.from(out.data, 'base64')
                    const mime = out.mime || 'image/png'
                    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png'
                    const key = `${B2_PREFIX}${userId}/${job.id}_${idx}.${ext}`
                    await s3Client.send(new PutObjectCommand({
                      Bucket: B2_BUCKET,
                      Key: key,
                      Body: buf,
                      ContentType: mime,
                      CacheControl: 'public, max-age=31536000',
                    }))
                    urls.push(`${process.env.B2_S3_ENDPOINT}/${B2_BUCKET}/${key}`)
                    idx += 1
                  }

                  const first = urls[0] || null
                  const extra = urls.slice(1)
                  const svc = await createServiceClient()
                  await svc
                    .from('generation_jobs')
                    .update({
                      status: 'completed',
                      result_url: first,
                      completed_at: new Date().toISOString(),
                      metadata: {
                        ...(job.metadata || {}),
                        extra_urls: extra,
                        operation_done: true,
                      } as any,
                    })
                    .eq('id', job.id)

                  const fresh = await svc
                    .from('generation_jobs')
                    .select('*')
                    .eq('id', jobId)
                    .single()
                  if (!fresh.error && fresh.data) {
                    job = fresh.data
                  }
                } else if (state && state !== 'JOB_STATE_SUCCEEDED') {
                  const errMsg: string =
                    (opJson?.error && (opJson.error.message || JSON.stringify(opJson.error))) ||
                    `Batch job ended with state ${state}`
                  const svc = await createServiceClient()
                  await svc
                    .from('generation_jobs')
                    .update({
                      status: 'failed',
                      error_message: errMsg,
                      completed_at: new Date().toISOString(),
                    })
                    .eq('id', job.id)
                  const fresh = await svc
                    .from('generation_jobs')
                    .select('*')
                    .eq('id', jobId)
                    .single()
                  if (!fresh.error && fresh.data) {
                    job = fresh.data
                  }
                }
              }
            }
          } catch (e) {
            // ignore polling errors; just return current job and try later
          }
        } else {
          // No operation recorded; if it's been too long, mark as failed to avoid endless processing
          const startedAt = job?.started_at ? new Date(job.started_at).getTime() : 0
          const ageMs = Date.now() - startedAt
          if (startedAt && ageMs > 15 * 60 * 1000) {
            const svc = await createServiceClient()
            await svc
              .from('generation_jobs')
              .update({
                status: 'failed',
                error_message: 'Batch job missing operation; timed out',
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.id)
            const fresh = await svc.from('generation_jobs').select('*').eq('id', jobId).single()
            if (!fresh.error && fresh.data) {
              job = fresh.data
            }
          }
        }
      }
    }

    // Return job status
    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      result_url: job.result_url,
      error_message: job.error_message,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      processing_time_ms: job.processing_time_ms,
      metadata: job.metadata,
    })

  } catch (e) {
    console.error('[api/generate/status] error', e)
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

