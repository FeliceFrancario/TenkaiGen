import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: process.env.B2_S3_REGION || 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.B2_S3_SECRET_ACCESS_KEY || '',
  },
})
const B2_BUCKET = process.env.B2_S3_BUCKET || 'dev-test-tenkaigen'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const url: string = String(body?.url || '')
    const operations: string[] = Array.isArray(body?.operations) ? body.operations : []
    if (!url || operations.length === 0) {
      return NextResponse.json({ error: 'url and operations[] required' }, { status: 400 })
    }

    const resp = await fetch(url, { cache: 'no-store' })
    if (!resp.ok) {
      const t = await resp.text().catch(() => '')
      return NextResponse.json({ error: `fetch failed: ${resp.status} ${t}` }, { status: 502 })
    }
    const inputBuf = Buffer.from(await resp.arrayBuffer())

    const sharp = (await import('sharp')).default
    let img = sharp(inputBuf).ensureAlpha()
    // Supported ops: 'sharpen','normalize','grayscale','invert','blur','saturation_plus','saturation_minus','tint_warm','tint_cool'
    for (const op of operations) {
      switch (op) {
        case 'sharpen':
          img = img.sharpen()
          break
        case 'normalize':
          img = img.normalize()
          break
        case 'grayscale':
          img = img.grayscale()
          break
        case 'invert':
          img = img.negate({ alpha: false })
          break
        case 'blur':
          img = img.blur(0.8)
          break
        case 'saturation_plus':
          img = img.modulate({ saturation: 1.25 })
          break
        case 'saturation_minus':
          img = img.modulate({ saturation: 0.8 })
          break
        case 'tint_warm':
          img = img.tint({ r: 255, g: 234, b: 210 })
          break
        case 'tint_cool':
          img = img.tint({ r: 210, g: 230, b: 255 })
          break
        default:
          break
      }
    }

    const outBuf = await img.png({ compressionLevel: 9 }).toBuffer()

    const u = new URL(url)
    const envBucket = B2_BUCKET
    let bucket = envBucket
    let path = u.pathname.replace(/^\/+/, '')
    if (path.startsWith('file/')) {
      const segs = path.split('/')
      bucket = segs[1]
      path = segs.slice(2).join('/')
    } else {
      const segs = path.split('/')
      if (segs[0] === envBucket) path = segs.slice(1).join('/')
    }
    const lastSlash = path.lastIndexOf('/')
    const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path
    const dirname = lastSlash >= 0 ? path.slice(0, lastSlash) : ''
    const base = filename.replace(/\.[^.]+$/, '')
    const suffix = operations.join('-')
    const outKey = dirname ? `${dirname}/${base}_pp_${suffix}.png` : `${base}_pp_${suffix}.png`

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket || envBucket,
      Key: outKey,
      Body: outBuf,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
    }))

    const outUrl = `${process.env.B2_S3_ENDPOINT}/${bucket}/${outKey}`
    return NextResponse.json({ url: outUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}


