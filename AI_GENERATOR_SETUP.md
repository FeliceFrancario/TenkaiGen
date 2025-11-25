# TenkaiGen AI Image Generator - Setup Guide

## Overview

The AI image generator uses:
- **Modal** for serverless GPU inference
- **Qwen Nanchaku** for high-quality image generation
- **Supabase** for job tracking and image storage
- **Next.js API routes** for orchestration

## Architecture Flow

```
User Input (Hero/Designer)
    ↓
LLM Prompt Parsing (/api/parse-prompt)
    ↓
Create Job (/api/generate)
    ↓
Modal GPU Inference (Qwen Nanchaku)
    ↓
Webhook Callback (/api/generate/webhook)
    ↓
Store in Supabase Storage
    ↓
UI Polls for Status (/api/generate/status/[jobId])
    ↓
Display Result
```

## Setup Steps

### 1. Database Migration

Apply the generation_jobs table migration:

```bash
# If using Supabase CLI
supabase migration up

# Or apply directly in Supabase Dashboard SQL Editor
# Run the contents of: supabase/migrations/015_create_generation_jobs_table.sql
```

This creates:
- `generation_jobs` table for tracking
- `generated-designs` storage bucket
- RLS policies for security

### 2. Modal Setup

#### Install Modal

```bash
pip install modal
```

#### Authenticate

```bash
python -m modal setup
```

Follow the browser prompt to authenticate.

#### Create Modal Secret

```bash
modal secret create tenkaigen-secrets \
  TENKAIGEN_WEBHOOK_URL=https://your-production-url.com/api/generate/webhook
```

**Important**: Replace `your-production-url.com` with your actual deployment URL (Vercel, Railway, etc.)

For local development:
```bash
modal secret create tenkaigen-secrets \
  TENKAIGEN_WEBHOOK_URL=http://localhost:3000/api/generate/webhook
```

Note: Webhooks to localhost won't work from Modal cloud. You'll need ngrok or similar for local testing.

#### Deploy Modal App

```bash
cd modal_app
modal deploy qwen_generator.py
```

This will:
1. Build container image (~5 minutes first time)
2. Download Qwen models (~2GB)
3. Cache in Modal volume
4. Deploy web endpoint
5. Output URL like: `https://username--tenkaigen-qwen-generator-generate-endpoint.modal.run`

**Copy this URL** - you'll need it for the next step.

### 3. Environment Variables

Update `frontend/.env.local`:

```env
# Modal AI Generation
MODAL_GENERATE_ENDPOINT=https://your-modal-url.modal.run

# Gemini for prompt parsing (recommended)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase (should already be set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Test the Integration

#### Option A: Local Test (requires Modal auth)

```bash
modal run modal_app/qwen_generator.py --prompt "A majestic dragon"
```

Should create `test_output.png`.

#### Option B: Test via API

1. Start your Next.js dev server:
```bash
cd frontend
npm run dev
```

2. Test generation endpoint:
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "prompt": "A majestic phoenix rising from flames",
    "expandedPrompt": "A majestic phoenix rising from flames, vibrant colors, detailed feathers, dramatic lighting. Ultra HD, 4K, cinematic composition.",
    "style": "Anime",
    "width": 1024,
    "height": 1024
  }'
```

Note: You need to be authenticated. Get the cookie from your browser's dev tools.

3. Check job status:
```bash
curl http://localhost:3000/api/generate/status/YOUR_JOB_ID \
  -H "Cookie: your-auth-cookie"
```

## Usage in UI

### Hero Page

Users can:
1. Enter a prompt in the hero section
2. System calls `/api/parse-prompt` to expand and structure the prompt
3. Navigates to catalog to select product
4. After product selection, calls `/api/generate`
5. Shows loading state while polling `/api/generate/status`
6. Displays generated image when complete

### Designer Page

Users can:
1. Navigate to designer from product page
2. Enter prompt in designer interface
3. Select style, color, size
4. Click "Generate"
5. System calls `/api/generate` with all parameters
6. Polls for status and displays result
7. User can position/resize design on product mockup

## Monitoring

### Modal Dashboard

Visit https://modal.com/apps to see:
- Active containers
- GPU usage
- Request logs
- Costs
- Failed requests

### Supabase Dashboard

Check `generation_jobs` table for:
- Job statuses
- Error messages
- Processing times
- User activity

### Next.js Logs

Monitor your Next.js logs for:
- `[api/generate]` - Job creation
- `[webhook]` - Result processing
- `[api/generate/status]` - Polling requests

## Cost Estimates

**Per Image Generation:**
- Modal GPU time: ~45 seconds on A10G
- Cost: ~$0.015 per image
- Storage: Supabase free tier (1GB)

**Monthly Estimates:**
- 1,000 images/month: ~$15
- 10,000 images/month: ~$150
- 100,000 images/month: ~$1,500

**Optimizations:**
1. Use Lightning model (4-step) for $0.003/image
2. Batch multiple requests
3. Cache popular prompts
4. Use spot instances (when available)

## Troubleshooting

### "MODAL_GENERATE_ENDPOINT not configured"

Set the environment variable in your `.env.local` and restart Next.js server.

### "Authentication required"

User must be logged in to generate images. Implement auth gates in UI.

### "Webhook failed"

- Check webhook URL is publicly accessible
- Verify Modal secret has correct URL
- Check Next.js webhook logs for errors
- Ensure Supabase service role key is valid

### "Job stuck in 'queued' status"

- Check Modal logs for errors
- Verify Modal endpoint URL is correct
- Check if Modal container is running
- Look for OOM errors in Modal dashboard

### Generation takes too long

- Default 50 steps takes ~45 seconds
- Switch to Lightning model for ~10 seconds
- Upgrade to A100 GPU for faster inference
- Reduce image dimensions

### Poor image quality

- Increase inference steps (50 → 100)
- Use r128 rank model instead of r32
- Improve prompt quality via LLM
- Add more style-specific keywords

## Next Steps

### Add Lightning Model Support

For 5x faster generation, uncomment Lightning sections in `qwen_generator.py`.

### Add LoRA Support for Franchises

When `franchise` is detected:
1. Download franchise-specific LoRA
2. Merge with base model
3. Generate with franchise style

### Implement Image-to-Image

Allow users to upload reference images:
1. Add img2img support to Modal
2. Pass image_base64 in request
3. Use Qwen's img2img pipeline

### Add Style Presets

Create preset configurations for each style:
- Different inference steps
- Custom negative prompts
- Specific CFG scales
- Style-specific LoRAs

## Production Checklist

- [ ] Database migration applied
- [ ] Modal app deployed
- [ ] Environment variables set
- [ ] Webhook URL configured in Modal secret
- [ ] Storage bucket created and accessible
- [ ] RLS policies tested
- [ ] Generation flow tested end-to-end
- [ ] Monitoring set up
- [ ] Error handling tested
- [ ] Rate limiting implemented
- [ ] Cost alerts configured

