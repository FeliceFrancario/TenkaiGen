import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const runtime = 'nodejs'

function makeClient() {
  const endpoint = process.env.B2_S3_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com'
  const region = process.env.B2_S3_REGION || 'us-east-005'
  const accessKeyId = process.env.B2_S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.B2_S3_SECRET_ACCESS_KEY
  const creds = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: false,
    credentials: creds as any,
  })
}

export async function GET(req: NextRequest) {
  try {
    const bucket = process.env.B2_S3_BUCKET || 'dev-test-tenkaigen'
    const prefix = process.env.B2_S3_PREFIX || '' // optional folder
    const endpoint = process.env.B2_S3_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com'

    const client = makeClient()
    const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, MaxKeys: 50 })
    const resp = await client.send(cmd)

    const keys = (resp.Contents || [])
      .map((o: { Key?: string } | undefined) => (o && o.Key) || '')
      .filter((k: string): k is string => !!k && /\.(png|jpg|jpeg|webp)$/i.test(k))
      .slice(0, 30)

    const urls = keys.map((k: string) => `${endpoint.replace(/\/$/, '')}/${bucket}/${encodeURIComponent(k)}`)

    return NextResponse.json({ result: urls })
  } catch (e: any) {
    console.error('[api/designs/list] error', e)
    // Fallback: Allow providing static URLs via env
    const staticList = (process.env.PUBLIC_B2_DESIGNS || '')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (staticList.length) {
      return NextResponse.json({ result: staticList })
    }
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
