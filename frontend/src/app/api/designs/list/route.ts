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

    const client = makeClient()
    const cmd = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix || undefined, MaxKeys: 50 })
    const resp = await client.send(cmd)

    const keys = (resp.Contents || [])
      .map((o: { Key?: string } | undefined) => (o && o.Key) || '')
      .filter((k: string): k is string => !!k && /\.(png|jpg|jpeg|webp)$/i.test(k))
      .slice(0, 30)

    // Generate presigned URLs for private objects
    const urls = await Promise.all(
      keys.map(async (key: string) => {
        try {
          const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key })
          // Generate presigned URL that expires in 1 hour
          const presignedUrl = await getSignedUrl(client, getCmd, { expiresIn: 3600 })
          return presignedUrl
        } catch (e) {
          console.error(`Failed to generate presigned URL for ${key}:`, e)
          return null
        }
      })
    )

    const validUrls = urls.filter((url): url is string => url !== null)

    // If we have valid presigned URLs, return them
    if (validUrls.length > 0) {
      return NextResponse.json({ result: validUrls })
    }

    // If presigned URLs failed, fall back to proxy approach
    const sampleDesigns = [
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00001_.png',
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00002_.png',
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00003_.png',
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00004_.png'
    ]
    
    const proxyUrls = sampleDesigns.map(url => `/api/designs/proxy?url=${encodeURIComponent(url)}`)
    return NextResponse.json({ result: proxyUrls })
  } catch (e: any) {
    console.error('[api/designs/list] error', e)
    // Fallback: Allow providing static URLs via env or use sample designs
    const staticList = (process.env.PUBLIC_B2_DESIGNS || '')
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
    
    // If no static URLs provided, use sample design URLs through proxy
    const sampleDesigns = [
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00001_.png',
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00002_.png',
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00003_.png',
      'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ComfyUI_temp_mbdml_00004_.png'
    ]
    
    // Convert direct B2 URLs to proxy URLs to avoid 401 errors
    const proxyUrls = sampleDesigns.map(url => `/api/designs/proxy?url=${encodeURIComponent(url)}`)
    const fallbackUrls = staticList.length > 0 ? staticList : proxyUrls
    return NextResponse.json({ result: fallbackUrls })
  }
}
