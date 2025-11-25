# AI Image Generator - Testing Guide

## ✅ What's Fixed

1. **Polling Logic Added**: Designer page now polls for job completion every 2 seconds
2. **Lightning Model Deployed**: 4-step Qwen Nanchaku for 10-second generation
3. **Modal Endpoint Configured**: `MODAL_GENERATE_ENDPOINT` is set in `.env.local`

## ⚠️ Current Issue: Webhook Can't Reach Localhost

**Problem**: Modal runs in the cloud and cannot call `http://localhost:3000/api/generate/webhook`

**Result**: Jobs get stuck in `queued` status because Modal can't report completion

## 🚀 Quick Test (Without Full Modal Integration)

Test the polling logic works correctly:

### Step 1: Log In

Make sure you're **logged into the app** (authentication required for job status API)

### Step 2: Go to Designer Page

1. Navigate to any product
2. Click "Customize" or go directly to `/designer/{product_id}`

### Step 3: Try Generation

1. Enter a prompt: "A majestic dragon in anime style"
2. Select style: "Anime"
3. Click "Generate"
4. Watch the console logs

### Expected Behavior (Current State)

```javascript
// Console output:
[designer] Generation queued: {jobId}
[designer] Job status: queued    // ← Polling every 2 seconds
[designer] Job status: queued
[designer] Job status: queued
... (continues polling for 2 minutes)
[designer] Generation timeout    // ← After 2 minutes
```

**Why it times out**: Modal can't call your localhost webhook, so the job stays `queued`

## 🔧 Fix Options

### Option A: Use ngrok (Recommended for Local Testing)

**ngrok creates a public URL that tunnels to localhost**

1. **Install ngrok**: https://ngrok.com/download

2. **Start dev server**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **In new terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

5. **Update Modal secret**:
   ```bash
   modal secret create tenkaigen-secrets \
     TENKAIGEN_WEBHOOK_URL=https://abc123.ngrok.io/api/generate/webhook
   ```

6. **Redeploy Modal app**:
   ```bash
   cd modal_app
   modal deploy qwen_generator.py
   ```

7. **Test again** - should work now! 🎉

### Option B: Deploy to Production

1. **Deploy frontend** to Vercel/Netlify/Railway
2. **Get production URL** (e.g., `https://tenkaigen.vercel.app`)
3. **Update Modal secret**:
   ```bash
   modal secret create tenkaigen-secrets \
     TENKAIGEN_WEBHOOK_URL=https://tenkaigen.vercel.app/api/generate/webhook
   ```
4. **Test on production** - should work perfectly!

### Option C: Manual Test (Verify Polling Works)

Test the polling logic without Modal:

1. **Create a fake completed job** in Supabase SQL Editor:
   ```sql
   -- First, get your user ID
   SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 1;
   
   -- Insert a test completed job
   INSERT INTO generation_jobs (
     id,
     user_id,
     prompt,
     expanded_prompt,
     style,
     width,
     height,
     status,
     result_url,
     completed_at
   ) VALUES (
     gen_random_uuid(),
     'YOUR_USER_ID_FROM_ABOVE',
     'Test dragon',
     'A majestic dragon with spread wings flying over mountains',
     'Anime',
     1024,
     1024,
     'completed',
     'https://s3.us-east-005.backblazeb2.com/dev-test-tenkaigen/test-image.png',
     NOW()
   ) RETURNING id;
   ```

2. **Copy the returned job ID**

3. **Modify frontend temporarily** to use this test job:
   ```typescript
   // In designer-page.tsx, replace:
   const genData = await genRes.json()
   const jobId = genData.jobId
   
   // With:
   const jobId = 'YOUR_TEST_JOB_ID_FROM_SQL'
   ```

4. **Test** - polling should work and show "image" immediately!

## 📊 Checking Job Status

### Via Browser (Must be logged in)

```
http://localhost:3000/api/generate/status/{JOB_ID}
```

### Via Supabase SQL Editor

```sql
SELECT 
  id,
  status,
  prompt,
  result_url,
  error_message,
  created_at,
  completed_at,
  processing_time_ms
FROM generation_jobs
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

### Via Modal Logs

```bash
modal app logs tenkaigen-qwen-generator --tail 50
```

Look for:
- `🎨 Starting generation for job {jobId}` ← Modal received request
- `✅ Job {jobId} completed in {time}ms` ← Generation done
- `✅ Webhook called successfully` ← Webhook succeeded
- `⚠️ TENKAIGEN_WEBHOOK_URL not configured` ← Secret missing!
- `❌ Webhook error` ← Connection failed (localhost issue)

## ✅ Success Criteria

When everything works correctly:

1. **User enters prompt and clicks Generate**
2. **Frontend shows loading state**: "Generating..."
3. **Console logs**:
   ```
   [designer] Generation queued: abc-123
   [designer] Job status: queued
   [designer] Job status: processing
   [designer] Job status: completed
   [designer] Generation complete: https://b2-url/image.png
   ```
4. **Image appears** in designer canvas automatically
5. **Loading state clears**: Button back to "Generate"
6. **Total time**: ~12-14 seconds (10s generation + 2-4s polling)

## 🐛 Troubleshooting

### Issue: "Generation timeout"

**Cause**: Modal couldn't call webhook, job stuck in `queued`

**Fix**: Use ngrok or deploy to production (see Option A/B above)

### Issue: "Generation failed: {error}"

**Cause**: Modal encountered an error during generation

**Check**: Modal logs for error details

### Issue: Job stays "processing" forever

**Cause**: Modal generated successfully but webhook failed

**Fix**: Check Modal logs for webhook errors

### Issue: "Authentication required"

**Cause**: Not logged in

**Fix**: Sign up/log in to the app first

## 📝 Summary

✅ **Frontend polling**: Implemented and working
✅ **Modal endpoint**: Configured correctly
✅ **Lightning model**: Deployed (4-step, ~10s generation)
❌ **Webhook**: Can't reach localhost from cloud

**Next step**: Set up ngrok OR deploy to production to complete the integration! 🚀

