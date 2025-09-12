import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const imageUrl = searchParams.get('url')
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
    }

    // Validate that the URL is from our B2 bucket
    if (!imageUrl.includes('s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/')) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
    }

    // Fetch the image from B2
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'TenkaiGen-Proxy/1.0',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status })
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (e: any) {
    console.error('[api/designs/proxy] error', e)
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 })
  }
}
