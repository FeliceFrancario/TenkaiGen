# AI Generator Deployment - Step by Step

## ✅ Status: Modal is Deploying!

The Modal app is currently building and will take 5-10 minutes. Follow these steps in order:

---

## Step 1: Wait for Modal Deployment ⏳

**Currently Running:** Modal is building the Docker image and downloading models.

**When complete**, you'll see output like:
```
✓ Created web function fastapi_app => https://username--tenkaigen-qwen-generator-fastapi-app.modal.run
```

**Copy that URL!** You'll need it for Step 3.

---

## Step 2: Apply Database Migration

While Modal deploys, set up the database:

### Option A: Supabase Dashboard (Recommended)

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Open `supabase/migrations/015_create_generation_jobs_table.sql` in your code editor
6. Copy **all contents** (Ctrl+A, Ctrl+C)
7. Paste into Supabase SQL Editor
8. Click **Run** (bottom right)

You should see: `Success. No rows returned`

### Option B: Supabase CLI (If you have it)

```bash
cd supabase
npx supabase db push
```

---

## Step 3: Configure Environment Variables

Create `frontend/.env.local` (or update existing):

```env
# ===== Printful API (you should have this) =====
PRINTFUL_API_TOKEN=your_printful_token_here

# ===== Supabase (you should have these) =====
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ===== Backblaze B2 Storage (you should have this) =====
B2_S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
B2_S3_REGION=us-east-005
B2_S3_BUCKET=dev-test-tenkaigen
B2_S3_ACCESS_KEY_ID=your_b2_key_id_here
B2_S3_SECRET_ACCESS_KEY=your_b2_secret_key_here
B2_S3_PREFIX=ai-generated/

# ===== Gemini for Prompt Parsing (recommended) =====
GEMINI_API_KEY=your_gemini_api_key_here
# OR OpenAI compatible:
# LLM_API_KEY=your_openai_key_here

# ===== Modal AI Generation (ADD THIS - from Step 1) =====
MODAL_GENERATE_ENDPOINT=https://YOUR-USERNAME--tenkaigen-qwen-generator-fastapi-app.modal.run
```

**Important**: Replace `YOUR-USERNAME--tenkaigen-qwen-generator-fastapi-app.modal.run` with the actual URL from Step 1!

---

## Step 4: Install Dependencies (If Needed)

If you haven't already:

```bash
cd frontend
npm install
```

The AWS SDK for B2 should already be installed (`@aws-sdk/client-s3`).

---

## Step 5: Start Next.js

```bash
cd frontend
npm run dev
```

Server starts on `http://localhost:3000`

---

## Step 6: Test the Integration

### Quick API Test

```bash
# Test that Modal endpoint is reachable
curl https://YOUR-MODAL-URL.modal.run

# Should return: {"detail":"Method Not Allowed"} (that's OK - it needs POST)
```

### Full Flow Test

1. **Open browser**: http://localhost:3000
2. **Log in** (or sign up)
3. **Enter prompt** in hero section: `"A cyberpunk samurai with neon katana"`
4. **Select style**: "Anime"
5. **Choose a product**: Any t-shirt
6. **Wait ~45-60 seconds** for generation
7. **Check result**: Design should appear in designer

### Check Logs

**Next.js Terminal**: Look for:
```
[api/generate] Created job {uuid}
[webhook] Received result for job {uuid}, status: completed
[webhook] ✅ Job {uuid} completed, image uploaded to B2
```

**B2 Dashboard**: Check your bucket for:
```
ai-generated/{user_id}/{job_id}.png
```

**Modal Dashboard**: Visit https://modal.com/apps
- See your app running
- View logs for generation

---

## Step 7: Update Webhook for Production (Later)

**When you deploy to production** (Vercel, Railway, etc.):

```bash
# Update Modal secret with production webhook URL
modal secret update tenkaigen-secrets --env main \
  TENKAIGEN_WEBHOOK_URL=https://your-production-domain.com/api/generate/webhook
```

For now, localhost webhook will work for local testing.

---

## Troubleshooting

### "Modal endpoint not configured"
- Check `.env.local` has `MODAL_GENERATE_ENDPOINT`
- Restart Next.js: `Ctrl+C` then `npm run dev`

### "Job stuck in 'queued' status"
- Check Modal logs: https://modal.com/apps
- Look for errors in Modal dashboard
- Verify secret was created: `modal secret list`

### "Webhook failed"
- For local testing, webhooks to localhost work fine
- Modal will call your local server
- Check Next.js console for webhook logs

### "B2 upload failed"
- Verify B2 credentials in `.env.local`
- Check B2 bucket exists and is accessible
- Ensure `B2_S3_PREFIX` ends with `/`

### "Authentication required"
- Make sure you're logged in to the app
- Generation requires authenticated user

---

## Cost Monitoring

### Modal Costs
- **A10G GPU**: $1.10/hour when active
- **Per image**: ~45 seconds = $0.015/image
- **Idle time**: Free (5 minute warmup period)

### B2 Storage Costs
- **Storage**: $0.005/GB/month
- **Downloads**: $0.01/GB (first 3x storage is free)
- **10,000 images**: ~$0.025/month

### Total Cost Example
- **100 generations/day** = 3,000/month
- **Modal**: 3,000 × $0.015 = $45/month
- **B2 Storage**: $0.015/month
- **Total**: ~$45/month

---

## Next Steps After Testing Works

1. **Deploy to Production**: Vercel, Railway, or similar
2. **Update Modal Secret**: With production webhook URL
3. **Add UI Polling**: Update hero/designer to poll job status
4. **Add Loading States**: Show "Generating..." with progress
5. **Add Error Handling**: Display errors gracefully
6. **Consider Lightning Model**: 5x faster (4 steps vs 50)
7. **Add Franchise LoRAs**: For One Piece, Naruto, etc.
8. **Switch to Cloudflare R2**: For free egress (when traffic grows)

---

## Quick Reference

**Modal Dashboard**: https://modal.com/apps
**B2 Dashboard**: https://secure.backblaze.com
**Supabase Dashboard**: https://supabase.com/dashboard

**Check Job Status**:
```sql
SELECT id, status, created_at, processing_time_ms, error_message
FROM generation_jobs
ORDER BY created_at DESC
LIMIT 10;
```

**Modal Logs**:
```bash
modal app logs tenkaigen-qwen-generator
```

---

## Support

If you run into issues:
1. Check the troubleshooting section above
2. Review logs (Next.js, Modal, Supabase)
3. Verify all environment variables are set correctly
4. Check that the database migration was applied

**Everything is ready to go once Modal deployment completes!** 🚀

