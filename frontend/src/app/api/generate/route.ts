import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Expected payload shape (flexible, we just log for now):
    // {
    //   productSlug, productName, variant, style, color, size, printArea,
    //   prompt, expandedPrompt, franchise
    // }
    console.log('[api/generate] received', body)

    // TODO: Integrate with Modal (serverless GPU) + Qwen Image or other pipelines.
    // For now, return a stub job id to allow UI to show skeletons and poll later.
    const jobId = `job_${Date.now()}`

    return NextResponse.json({ jobId, status: 'queued' })
  } catch (e) {
    console.error('[api/generate] error', e)
    return NextResponse.json({ error: 'Failed to queue generation' }, { status: 500 })
  }
}
