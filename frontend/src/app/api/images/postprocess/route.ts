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

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const url: string = String(body?.url || '')
    const operations: any[] = Array.isArray(body?.operations) ? body.operations : []
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
    let meta: import('sharp').Metadata | null = null
    const ensureMeta = async () => {
      if (!meta) {
        meta = await img.metadata()
      }
      return meta
    }

    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

    // Supported ops (strings): 'sharpen','normalize','grayscale','invert','blur','saturation_plus','saturation_minus','tint_warm','tint_cool'
    // Supported ops (objects): { type: 'adjust', exposure?, contrast?, saturation?, vibrance?, warmth?, hue?, tint?, shadows?, highlights? }
    //                          { type: 'rotate', degrees }
    //                          { type: 'flip', horizontal?, vertical? }
    //                          { type: 'crop', x,y,width,height }
    //                          { type: 'cropPercent', inset } // inset percent 0-45 trimmed equally from each edge
    for (const op of operations) {
      if (typeof op === 'string') {
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
        continue
      }

      if (op && typeof op === 'object' && op.type === 'adjust') {
        const exposure = clamp(Number(op.exposure ?? 0), -100, 100) // +/- lightness
        const contrast = clamp(Number(op.contrast ?? 0), -100, 100)
        const saturation = clamp(Number(op.saturation ?? 0), -100, 100)
        const vibrance = clamp(Number(op.vibrance ?? 0), -100, 100)
        const warmth = clamp(Number(op.warmth ?? 0), -100, 100) // hue shift degrees-ish
        const hue = clamp(Number(op.hue ?? 0), -180, 180)

        const modulate: any = {}
        if (exposure !== 0) modulate.brightness = 1 + exposure / 100
        if (saturation !== 0) modulate.saturation = 1 + saturation / 100
        if (vibrance !== 0) modulate.saturation = (modulate.saturation || 1) * (1 + vibrance / 150)
        if (warmth !== 0 || hue !== 0) modulate.hue = clamp((warmth || 0) + (hue || 0), -180, 180)
        if (Object.keys(modulate).length > 0) img = img.modulate(modulate)

        if (contrast !== 0) {
          const c = 1 + contrast / 100
          img = img.linear(c, 128 * (1 - c))
        }

        const shadows = clamp(Number(op.shadows ?? 0), -100, 100)
        if (shadows !== 0) {
          const gamma = shadows > 0 ? 1 - shadows / 200 : 1 + Math.abs(shadows) / 300
          img = img.gamma(clamp(gamma, 0.5, 2.5))
        }
        const highlights = clamp(Number(op.highlights ?? 0), -100, 100)
        if (highlights !== 0) {
          const c = highlights > 0 ? 1 - highlights / 200 : 1 + Math.abs(highlights) / 200
          img = img.linear(c, 128 * (1 - c))
        }
        continue
      }

      if (op && typeof op === 'object' && op.type === 'rotate') {
        const deg = clamp(Number(op.degrees ?? 0), -360, 360)
        if (deg !== 0) img = img.rotate(deg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        continue
      }

      if (op && typeof op === 'object' && op.type === 'flip') {
        if (op.horizontal) img = img.flip()
        if (op.vertical) img = img.flop()
        continue
      }

      if (op && typeof op === 'object' && op.type === 'crop') {
        const x = Math.max(0, Number(op.x || 0))
        const y = Math.max(0, Number(op.y || 0))
        const width = Math.max(1, Number(op.width || 0))
        const height = Math.max(1, Number(op.height || 0))
        img = img.extract({ left: Math.floor(x), top: Math.floor(y), width: Math.floor(width), height: Math.floor(height) })
        continue
      }

      if (op && typeof op === 'object' && op.type === 'cropPercent') {
        const insetPct = clamp(Number(op.inset ?? 0), 0, 45)
        if (insetPct > 0) {
          const m = await ensureMeta()
          const w = m.width || 0
          const h = m.height || 0
          if (w > 1 && h > 1) {
            const dx = Math.floor((w * insetPct) / 100)
            const dy = Math.floor((h * insetPct) / 100)
            const width = Math.max(1, w - dx * 2)
            const height = Math.max(1, h - dy * 2)
            img = img.extract({ left: dx, top: dy, width, height })
          }
        }
        continue
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
    const suffix = operations
      .map((op: any) => {
        if (typeof op === 'string') return op
        if (op && typeof op === 'object' && op.type) return op.type
        return 'op'
      })
      .join('-')
    const outKey = dirname ? `${dirname}/${base}_pp_${suffix}.png` : `${base}_pp_${suffix}.png`

    const bucketResolved = bucket || envBucket

    await s3Client.send(new PutObjectCommand({
      Bucket: bucketResolved,
      Key: outKey,
      Body: outBuf,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000',
    }))

    const outUrl = `${process.env.B2_S3_ENDPOINT}/${bucketResolved}/${outKey}`
    let signedUrl: string | null = null
    try {
      signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({ Bucket: bucketResolved, Key: outKey }),
        { expiresIn: 3600 }
      )
    } catch (e) {
      console.warn('[postprocess] signed URL failed', e)
    }

    return NextResponse.json({ url: outUrl, signedUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 })
  }
}


