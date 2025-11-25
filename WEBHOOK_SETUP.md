# Webhook Setup for Local Development

## The Problem

Modal runs in the cloud and needs to call your webhook at `/api/generate/webhook` when generation completes. However, **Modal cannot reach `localhost:3000`** from the cloud!

## Solutions

### Option 1: Use ngrok (Recommended for Local Testing)

**ngrok** creates a public tunnel to your localhost:

1. **Install ngrok**: https://ngrok.com/download

2. **Start Next.js dev server**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **In another terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (looks like `https://abc123.ngrok.io`)

5. **Update Modal secret**:
   ```bash
   modal secret create tenkaigen-secrets \
     TENKAIGEN_WEBHOOK_URL=https://abc123.ngrok.io/api/generate/webhook
   ```

6. **Test generation** - now Modal can call your local webhook!

**Note**: ngrok URLs change each time you restart (unless you have a paid plan). You'll need to update the Modal secret each time.

### Option 2: Deploy to Production (Recommended for MVP)

Deploy your Next.js app to Vercel/Netlify/etc:

1. **Deploy frontend** to production

2. **Update Modal secret** with production URL:
   ```bash
   modal secret create tenkaigen-secrets \
     TENKAIGEN_WEBHOOK_URL=https://your-production-domain.com/api/generate/webhook
   ```

3. **Done!** Modal can now call your production webhook

### Option 3: Skip Webhook for Now (Quick Test)

For quick testing without webhooks:

1. **Comment out Modal endpoint call** in `frontend/src/app/api/generate/route.ts`:
   ```typescript
   // Temporarily disable Modal call for testing
   // fetch(MODAL_GENERATE_ENDPOINT, { ... })
   ```

2. **Manually test polling** by creating a fake completed job in database:
   ```sql
   -- In Supabase SQL Editor
   UPDATE generation_jobs 
   SET 
     status = 'completed',
     result_url = 'https://your-b2-bucket.com/test-image.png',
     completed_at = NOW()
   WHERE id = 'YOUR_JOB_ID';
   ```

3. **Frontend polling** will pick up the completed job and show the image

## Current Status

Based on your terminal logs:

```
[api/generate] Created job 149807f8-cad9-4e88-b6b1-85da18cf289c
```

The job was created, but **Modal likely couldn't call your localhost webhook**, so the job is stuck in `queued` status.

## Verify Job Status

Check the job in Supabase:

```sql
SELECT id, status, created_at, error_message 
FROM generation_jobs 
ORDER BY created_at DESC 
LIMIT 5;
```

If `status = 'queued'` and it's been more than 2 minutes, Modal either:
1. ❌ Couldn't reach the webhook (localhost issue)
2. ❌ Secret not configured correctly
3. ❌ Generation failed

## Check Modal Logs

```bash
modal app logs tenkaigen-qwen-generator --tail 50
```

Look for:
- `✅ Webhook called successfully for job {jobId}` ← Good!
- `⚠️ TENKAIGEN_WEBHOOK_URL not configured` ← Secret missing!
- `❌ Webhook error for job {jobId}` ← Connection failed!

## Recommended Next Steps

### For Local Development:

1. **Install ngrok** (free)
2. **Start ngrok**: `ngrok http 3000`
3. **Update Modal secret** with ngrok URL
4. **Test generation** in designer page

### For Production:

1. **Deploy frontend** to Vercel/Netlify
2. **Update Modal secret** with production URL
3. **Test generation** end-to-end

## Testing Without Webhook (Alternative)

If you want to test the frontend polling logic without Modal:

1. **Create a test job manually**:
   ```sql
   INSERT INTO generation_jobs (
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
     'YOUR_USER_ID',
     'Test prompt',
     'Test expanded prompt',
     'Anime',
     1024,
     1024,
     'completed',
     'https://your-b2-bucket.com/test-image.png',
     NOW()
   );
   ```

2. **Copy the job ID**

3. **Test polling** by calling:
   ```bash
   curl http://localhost:3000/api/generate/status/{JOB_ID}
   ```

4. **Should return**:
   ```json
   {
     "jobId": "...",
     "status": "completed",
     "resultUrl": "https://..."
   }
   ```

This confirms the polling logic works!

## Summary

✅ **Frontend configured**: `MODAL_GENERATE_ENDPOINT` is set
✅ **Polling logic added**: Designer page now polls for completion
❌ **Webhook unreachable**: Modal can't call localhost

**Quick fix**: Use ngrok to tunnel localhost → public URL
**Production fix**: Deploy frontend and use production URL

