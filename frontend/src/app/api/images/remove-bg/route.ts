import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: process.env.B2_S3_REGION || 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.B2_S3_SECRET_ACCESS_KEY || '',
  },
})
const B2_BUCKET = process.env.B2_S3_BUCKET || 'dev-test-tenkaigen'

async function whiteToAlpha(buffer: Buffer, threshold: number): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default
    const img = sharp(buffer).ensureAlpha()
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
    const stride = info.channels
    const out = Buffer.from(data)
    for (let i = 0; i < out.length; i += stride) {
      const r = out[i], g = out[i + 1], b = out[i + 2]
      out[i + 3] = (r >= threshold && g >= threshold && b >= threshold) ? 0 : 255
    }
    return await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
  } catch {
    return buffer
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const url: string = String(body?.url || '')
    const threshold: number = Math.max(200, Math.min(255, Number(body?.threshold || 245)))
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const resp = await fetch(url, { cache: 'no-store' })
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return NextResponse.json({ error: `fetch failed: ${resp.status} ${t}` }, { status: 502 })
    }
    const inputBuf = Buffer.from(await resp.arrayBuffer())
    const outBuf = await whiteToAlpha(inputBuf, threshold)

    const u = new URL(url)
    const envBucket = B2_BUCKET
    let bucket = envBucket
    let path = u.pathname.replace(/^\/+/, '')
    if (path.startsWith('file/')) {
      const segs = path.split('/')
      if (segs.length >= 3) {
        bucket = segs[1]
        path = segs.slice(2).join('/')
      } else {
        return NextResponse.json({ error: 'unexpected URL format' }, { status: 400 })
      }
    } else {
      const segs = path.split('/')
      if (segs[0] === envBucket) {
        path = segs.slice(1).join('/')
      } else if (u.hostname.startsWith(envBucket + '.')) {
        bucket = envBucket
      } else if (segs.length >= 2) {
        path = segs.slice(1).join('/')
      }
    }

    const lastSlash = path.lastIndexOf('/')
    const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path
    const dirname = lastSlash >= 0 ? path.slice(0, lastSlash) : ''
    const base = filename.replace(/\.[^.]+$/, '')
    const outKey = dirname ? `${dirname}/${base}_alpha.png` : `${base}_alpha.png`

    const bucketResolved = bucket || envBucket
    await s3Client.send(new PutObjectCommand({
      Bucket: bucketResolved,
      Key: outKey,
      Body: outBuf,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
    }))

    const outUrl = `${process.env.B2_S3_ENDPOINT}/${bucketResolved}/${outKey}`

    // Signed URL for private bucket preview
    let signedUrl: string | null = null
    try {
      signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: bucketResolved, Key: outKey }),
        { expiresIn: 3600 }
      )
    } catch (e) {
      console.warn('[remove-bg] signed URL failed', e)
    }

    return NextResponse.json({ url: outUrl, signedUrl, threshold })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}


