import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/database'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

// Initialize B2 S3 client
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

/**
 * Webhook endpoint for Modal to report generation results
 * 
 * POST /api/generate/webhook
 * Body:
 * {
 *   job_id: string,
 *   status: 'completed' | 'failed',
 *   image_base64?: string,  // base64 encoded PNG
 *   error?: string,
 *   processing_time_ms?: number,
 *   metadata?: object
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      job_id,
      status,
      image_base64,
      error,
      processing_time_ms,
      metadata
    } = body

    console.log(`[webhook] Received result for job ${job_id}, status: ${status}`)

    if (!job_id || !status) {
      return NextResponse.json(
        { error: 'job_id and status are required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    if (status === 'completed' && image_base64) {
      // Upload image to B2 Storage
      try {
        // Fetch job to get user_id
        const { data: job } = await supabase
          .from('generation_jobs')
          .select('user_id')
          .eq('id', job_id)
          .single()

        if (!job) {
          console.error(`[webhook] Job ${job_id} not found`)
          return NextResponse.json(
            { error: 'Job not found' },
            { status: 404 }
          )
        }

        // Decode base64 image
        const imageBuffer = Buffer.from(image_base64, 'base64')
        
        // Upload to B2: ai-generated/{user_id}/{job_id}.png
        const key = `${B2_PREFIX}${job.user_id}/${job_id}.png`
        
        const uploadCommand = new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: key,
          Body: imageBuffer,
          ContentType: 'image/png',
          CacheControl: 'public, max-age=31536000', // Cache for 1 year
        })

        await s3Client.send(uploadCommand)

        // Construct public URL
        const result_url = `${process.env.B2_S3_ENDPOINT}/${B2_BUCKET}/${key}`

        // Update job with success
        const { error: updateError } = await supabase
          .from('generation_jobs')
          .update({
            status: 'completed',
            result_url,
            completed_at: new Date().toISOString(),
            processing_time_ms,
            metadata: metadata || {}
          })
          .eq('id', job_id)

        if (updateError) {
          console.error(`[webhook] Failed to update job ${job_id}:`, updateError)
          return NextResponse.json(
            { error: 'Failed to update job' },
            { status: 500 }
          )
        }

        console.log(`[webhook] ✅ Job ${job_id} completed, image uploaded to ${result_url}`)
        
        return NextResponse.json({
          success: true,
          result_url
        })

      } catch (err) {
        console.error(`[webhook] Error processing job ${job_id}:`, err)
        
        // Mark job as failed
        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Failed to process image',
            completed_at: new Date().toISOString()
          })
          .eq('id', job_id)

        return NextResponse.json(
          { error: 'Failed to process image' },
          { status: 500 }
        )
      }

    } else if (status === 'failed') {
      // Update job with failure
      const { error: updateError } = await supabase
        .from('generation_jobs')
        .update({
          status: 'failed',
          error_message: error || 'Generation failed',
          completed_at: new Date().toISOString(),
          processing_time_ms
        })
        .eq('id', job_id)

      if (updateError) {
        console.error(`[webhook] Failed to update job ${job_id}:`, updateError)
        return NextResponse.json(
          { error: 'Failed to update job' },
          { status: 500 }
        )
      }

      console.log(`[webhook] ❌ Job ${job_id} failed: ${error}`)
      
      return NextResponse.json({ success: true })

    } else {
      return NextResponse.json(
        { error: 'Invalid status or missing image data' },
        { status: 400 }
      )
    }

  } catch (e) {
    console.error('[webhook] error', e)
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    )
  }
}

