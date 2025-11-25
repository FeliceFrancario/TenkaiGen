# TenkaiGen AI Generator - Setup with B2 Storage

## ✅ Updated: Now Using Backblaze B2 for Storage

We've updated the implementation to use your existing Backblaze B2 storage instead of Supabase Storage. This is more economical and you already have it configured!

## Architecture

```
User Input (Hero/Designer)
    ↓
LLM Prompt Parsing (/api/parse-prompt)
    ↓
Create Job in Supabase DB (/api/generate)
    ↓
Modal GPU Inference (Qwen Nanchaku)
    ↓
Webhook Callback (/api/generate/webhook)
    ↓
Upload to Backblaze B2 (S3-compatible)
    ↓
UI Polls for Status (/api/generate/status/[jobId])
    ↓
Display Result
```

## Cost Comparison

### Backblaze B2 (Your Current Choice ✅)
- **Storage**: $0.005/GB/month
- **Downloads**: $0.01/GB (first 3x storage is free)
- **API Calls**: Free
- **Example**: 1,000 images (500MB) = **$0.003/month storage** + free downloads

### Supabase Storage (Alternative)
- **Free tier**: 1GB storage + 2GB bandwidth
- **Paid**: $0.021/GB/month storage
- **Example**: 1,000 images = $0.010/month

### **B2 is 3-7x cheaper!** 🎉

## Setup Steps

### 1. Database Migration

Apply migration in Supabase Dashboard → SQL Editor:

```sql
-- Copy and paste: supabase/migrations/015_create_generation_jobs_table.sql
```

This creates the `generation_jobs` table (no storage bucket needed - we use B2!)

### 2. Environment Variables

You already have B2 configured! Just verify in `frontend/.env.local`:

```env
# Backblaze B2 (already configured)
B2_S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_S3_REGION=us-east-005
B2_S3_BUCKET=dev-test-tenkaigen
B2_S3_ACCESS_KEY_ID=your_b2_key_id
B2_S3_SECRET_ACCESS_KEY=your_b2_secret_key
B2_S3_PREFIX=ai-generated/  # Folder for AI images

# Modal AI Generation (add after deployment)
MODAL_GENERATE_ENDPOINT=https://your-modal-url.modal.run

# Gemini for prompt parsing
GEMINI_API_KEY=your_gemini_api_key

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Printful (already configured)
PRINTFUL_API_TOKEN=your_printful_token
```

### 3. Deploy Modal

```bash
# The secret is already created! Just deploy:
cd modal_app
modal deploy qwen_generator.py
```

This will output a URL like:
```
https://username--tenkaigen-qwen-generator-fastapi-app.modal.run
```

**Copy this URL!**

### 4. Update Environment

Add Modal URL to `frontend/.env.local`:

```env
MODAL_GENERATE_ENDPOINT=https://YOUR-MODAL-URL.modal.run
```

### 5. Update Modal Webhook (Production)

When you deploy to production (Vercel/Railway), update the Modal secret:

```bash
modal secret update tenkaigen-secrets \
  TENKAIGEN_WEBHOOK_URL=https://your-production-url.com/api/generate/webhook
```

## How B2 Storage Works

### File Structure

Generated images are stored as:
```
dev-test-tenkaigen/
└── ai-generated/
    ├── {user_id_1}/
    │   ├── {job_id_1}.png
    │   ├── {job_id_2}.png
    │   └── ...
    ├── {user_id_2}/
    │   └── ...
    └── ...
```

### Public URLs

Images are publicly accessible at:
```
https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/ai-generated/{user_id}/{job_id}.png
```

### Cost Example

**Scenario**: 10,000 users generate 1 image each per month
- **Storage**: 5GB × $0.005 = **$0.025/month**
- **Downloads**: 10,000 × 1MB = 10GB
  - First 15GB free (3x storage)
  - **Cost: $0**
- **Total**: **$0.025/month** for 10,000 images!

Compare to Supabase: $0.105/month (4x more expensive)

## Testing

### 1. Test Modal Locally

```bash
modal run modal_app/qwen_generator.py --prompt "A dragon"
# Creates test_output.png
```

### 2. Test Full Flow

1. Start Next.js:
```bash
cd frontend
npm run dev
```

2. Log in to your app

3. Enter prompt in hero: "A cyberpunk samurai with neon lights"

4. Select style: "Anime"

5. Choose a product

6. Wait ~45 seconds

7. Check B2 bucket for uploaded image

## Switching to Cloudflare R2 (Future)

If you want to switch to Cloudflare R2 later, it's S3-compatible too! Just update:

```env
B2_S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
B2_S3_REGION=auto
B2_S3_BUCKET=tenkaigen-images
B2_S3_ACCESS_KEY_ID=your_r2_access_key
B2_S3_SECRET_ACCESS_KEY=your_r2_secret_key
```

**Cloudflare R2 Pricing:**
- Storage: $0.015/GB/month
- Downloads: **$0** (completely free!)
- Operations: $4.50 per million writes

For high-traffic sites, R2 is even better (free egress!).

## B2 vs Cloudflare R2 Comparison

| Feature | Backblaze B2 | Cloudflare R2 |
|---------|--------------|---------------|
| Storage | $0.005/GB/mo | $0.015/GB/mo |
| Downloads | $0.01/GB (3x free) | **$0** (unlimited) |
| API Calls | Free | $4.50/M writes |
| **Best For** | Low traffic, storage-heavy | High traffic, download-heavy |

**Recommendation**: 
- Start with B2 (cheaper storage)
- Switch to R2 when you have >100K views/month

## Monitoring B2 Usage

### Via B2 Dashboard
1. Go to https://secure.backblaze.com
2. Click **Buckets**
3. Select `dev-test-tenkaigen`
4. See storage usage and bandwidth

### Via Code

Check your `generation_jobs` table:

```sql
SELECT 
  COUNT(*) as total_generations,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
  AVG(processing_time_ms) as avg_time_ms
FROM generation_jobs
WHERE created_at > NOW() - INTERVAL '30 days';
```

## Troubleshooting

### "Failed to upload to B2"

**Check:**
1. B2 credentials are correct in `.env.local`
2. Bucket exists and is accessible
3. B2 endpoint URL is correct
4. Network connectivity

### "Job completed but no image URL"

**Check:**
1. Webhook logs in Next.js console
2. B2 bucket for the file
3. File permissions (should be public)

### "Modal can't reach webhook"

**Remember:**
- `localhost` webhooks won't work from Modal cloud
- Use ngrok for local testing
- Or deploy to Vercel/Railway for production testing

## Production Checklist

- [x] Database migration applied
- [x] B2 bucket configured (already done!)
- [ ] Modal app deployed
- [ ] Modal URL added to `.env.local`
- [ ] Webhook URL updated in Modal secret (production only)
- [ ] Test generation end-to-end
- [ ] Monitor B2 costs
- [ ] Set up B2 lifecycle rules (optional - auto-delete old images)

## B2 Lifecycle Rules (Optional)

To auto-delete images older than 90 days:

1. Go to B2 Dashboard → Buckets
2. Click `dev-test-tenkaigen`
3. **Lifecycle Settings** → **Add Rule**
4. Configure:
   - Prefix: `ai-generated/`
   - Delete after: 90 days
   - Apply to: Previous versions

This keeps your storage lean and costs minimal!

---

**Summary**: You're now using the most cost-effective storage solution! B2 will cost you ~$0.025/month for 10,000 images, compared to $0.10+ with other providers. 🎉

