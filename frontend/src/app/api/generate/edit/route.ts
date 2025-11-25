import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY
const EDIT_MODEL_ID = 'gemini-2.5-flash'

const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: process.env.B2_S3_REGION || 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.B2_S3_SECRET_ACCESS_KEY || '',
  },
})
const B2_BUCKET = process.env.B2_S3_BUCKET || 'dev-test-tenkaigen'
const B2_PREFIX = process.env.B2_S3_PREFIX || 'ai-generated/edits/'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { image_base64, prompt, width = 1024, height = 1024 } = body || {}

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    if (!image_base64 || !prompt) {
      return NextResponse.json({ error: 'image_base64 and prompt are required' }, { status: 400 })
    }

    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    const g = gcd(width, height)
    const aspectRatio = `${Math.round(width / g)}:${Math.round(height / g)}`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EDIT_MODEL_ID}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Edit the provided image according to: ${prompt}` },
              { inlineData: { mimeType: 'image/png', data: image_base64 } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio },
        } as any,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json({ error: `Gemini edit failed: ${res.status} ${text}` }, { status: 500 })
    }
    const json = await res.json()
    let out64: string | null = null
    let outMime: string = 'image/png'
    const candidates = json?.candidates || []
    for (const c of candidates) {
      const parts = c?.content?.parts || []
      for (const p of parts) {
        const data = p?.inlineData?.data
        const mime = p?.inlineData?.mimeType
        if (data && typeof data === 'string') {
          out64 = data
          if (typeof mime === 'string') outMime = mime
          break
        }
      }
      if (out64) break
    }
    if (!out64) {
      return NextResponse.json({ error: 'No image returned' }, { status: 500 })
    }

    // Upload result
    const buf = Buffer.from(out64, 'base64')
    const ext = outMime.includes('png') ? 'png' : outMime.includes('webp') ? 'webp' : outMime.includes('jpeg') || outMime.includes('jpg') ? 'jpg' : 'png'
    const key = `${B2_PREFIX}${Date.now()}.${ext}`
    await s3Client.send(new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: outMime,
      CacheControl: 'public, max-age=31536000',
    }))
    const publicUrl = `${process.env.B2_S3_ENDPOINT}/${B2_BUCKET}/${key}`

    return NextResponse.json({ url: publicUrl })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to edit image' }, { status: 500 })
  }
}


