import { NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'

function makeClient() {
  const endpoint = process.env.B2_S3_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com'
  const region = process.env.B2_S3_REGION || 'us-east-005'
  const accessKeyId = process.env.B2_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.B2_S3_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing B2 credentials')
  }
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: false,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function extractKeyFromUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url, 'http://dummy-base/')
    // Path may be like /<bucket>/<key...>
    const parts = u.pathname.split('/').filter(Boolean)
    const bIdx = parts.findIndex((p) => p === bucket)
    if (bIdx >= 0 && parts.length > bIdx + 1) {
      const keyParts = parts.slice(bIdx + 1)
      return decodeURIComponent(keyParts.join('/'))
    }
    // If endpoint is a custom domain that already maps to bucket root, try entire path
    if (parts.length > 0) {
      return decodeURIComponent(parts.join('/'))
    }
    return null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const bucket = process.env.B2_S3_BUCKET || 'dev-test-tenkaigen'
    const body = await req.json().catch(() => ({}))
    const url = String(body?.url || '')
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
    const key = extractKeyFromUrl(url, bucket)
    if (!key) {
      return NextResponse.json({ error: 'Unable to derive object key from URL' }, { status: 400 })
    }

    const client = makeClient()
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))

    return NextResponse.json({ ok: true, key })
  } catch (e: any) {
    console.error('[api/designs/delete] error', e)
    return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 })
  }
}


