# ngrok Setup - Complete Guide

## Step 1: Download & Install ngrok

### Option A: Direct Download (Recommended)

1. **Download ngrok**: https://ngrok.com/download
2. **Choose**: Windows (64-bit)
3. **Extract** the zip file
4. **Move** `ngrok.exe` to a permanent location:
   ```
   Recommended: C:\Users\franc\ngrok\ngrok.exe
   ```
5. **Add to PATH** (optional but helpful):
   - Right-click "This PC" → Properties
   - Advanced system settings → Environment Variables
   - Under "User variables", select "Path" → Edit
   - Click "New" → Add: `C:\Users\franc\ngrok`
   - Click OK on all dialogs
   - Restart PowerShell

### Option B: Via Chocolatey (If you have it)

```powershell
choco install ngrok
```

## Step 2: Create Free ngrok Account (Optional but Recommended)

1. **Sign up**: https://dashboard.ngrok.com/signup
2. **Get your authtoken** from: https://dashboard.ngrok.com/get-started/your-authtoken
3. **Authenticate** (one-time):
   ```bash
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```

**Benefits:**
- Longer session times
- Better URLs
- More simultaneous tunnels

**Without account:**
- Still works fine for testing
- URL changes each restart
- Limited features

## Step 3: Start Your Dev Server

In your **first terminal**, start Next.js:

```bash
cd frontend
npm run dev
```

Keep this running! You should see:
```
✓ Ready on http://localhost:3000
```

## Step 4: Start ngrok

In a **second terminal**, start ngrok:

```bash
# If you added to PATH:
ngrok http 3000

# Or run directly:
C:\Users\franc\ngrok\ngrok.exe http 3000
```

You'll see output like:
```
ngrok                                                                           

Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc-123-def.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

**🎯 COPY THIS URL:** `https://abc-123-def.ngrok-free.app`

## Step 5: Update Modal Secret

In a **third terminal**:

```bash
modal secret create tenkaigen-secrets \
  TENKAIGEN_WEBHOOK_URL=https://abc-123-def.ngrok-free.app/api/generate/webhook
```

Replace `abc-123-def.ngrok-free.app` with YOUR actual ngrok URL!

**Confirm with:** `y` when prompted

## Step 6: Verify Modal App is Deployed

The Modal app should already be deployed (you have the endpoint URL). Let's verify:

```bash
cd modal_app
modal app list
```

If you don't see `tenkaigen-qwen-generator`, deploy it:

```bash
modal deploy qwen_generator.py
```

Wait for it to finish (~2-3 minutes).

## Step 7: Test the Generation! 🎨

1. **Open browser**: http://localhost:3000
2. **Make sure you're logged in**
3. **Navigate to any product** and click "Customize"
4. **Go to "AI" tab** in the designer
5. **Enter a prompt**:
   ```
   A majestic blue dragon flying over mountains at sunset
   ```
6. **Select style**: "Anime"
7. **Click "Generate"**
8. **Wait ~12-14 seconds**
9. **Image should appear!** 🎉

## Step 8: Monitor the Logs

### Terminal 1 (Next.js Dev Server)
Look for:
```
[api/generate] Created job abc-123-def
[webhook] Received result for job abc-123-def
[webhook] Uploaded to B2: https://...
```

### Terminal 2 (ngrok)
Look for:
```
POST /api/generate/webhook    200 OK
```

### Terminal 3 (Optional - Modal Logs)
```bash
modal app logs tenkaigen-qwen-generator --tail 50
```

Look for:
```
🎨 Starting generation for job abc-123
✅ Job abc-123 completed in 10234ms
✅ Webhook called successfully
```

### Browser Console (F12)
Look for:
```
[designer] Generation queued: abc-123
[designer] Job status: queued
[designer] Job status: processing
[designer] Job status: completed
[designer] Generation complete: https://b2.../image.png
```

## Step 9: Visit ngrok Inspector (Optional)

**Open**: http://localhost:4040

This shows ALL HTTP requests going through ngrok in real-time!

You can see:
- When Modal calls your webhook
- The exact payload sent
- Response from your server
- Timing information

Great for debugging! 🔍

## Troubleshooting

### Issue: "modal: command not found"

**Fix:**
```bash
pip install modal
modal setup
```

### Issue: ngrok shows "ERR_NGROK_108"

**Fix:** You need to sign up and add authtoken:
```bash
ngrok config add-authtoken YOUR_TOKEN
```

### Issue: Modal secret not updating

**Fix:** Delete and recreate:
```bash
modal secret delete tenkaigen-secrets
modal secret create tenkaigen-secrets \
  TENKAIGEN_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/api/generate/webhook
```

### Issue: Generation times out

**Check:**
1. Modal app is deployed: `modal app list`
2. Modal secret is correct: Should have webhook URL
3. ngrok is still running: Should show "online"
4. Next.js dev server is running: Should show on Terminal 1

### Issue: "Job not found" error

**Cause:** Not logged in or using wrong user

**Fix:**
1. Make sure you're logged into the app
2. Try clearing browser cache
3. Log out and log back in

## What You Should See (Success Flow)

```
User enters prompt → Click Generate
    ↓
[0s] Frontend: Creating job in DB...
[0s] Frontend: Calling Modal...
[2s] Frontend: Polling for status... (queued)
[4s] Frontend: Polling for status... (queued)
[6s] Frontend: Polling for status... (processing)
[8s] Frontend: Polling for status... (processing)
[10s] Modal: Generation complete! Calling webhook...
[11s] ngrok: Received POST /api/generate/webhook
[11s] Webhook: Uploading to B2...
[12s] Webhook: Updating DB status=completed
[13s] Frontend: Polling... (completed!)
[13s] Frontend: Loading image from B2...
[14s] Image appears in designer! 🎉
```

**Total time: 12-14 seconds**

## When You're Done Testing

1. **Stop ngrok** (Ctrl+C in Terminal 2)
2. **Stop dev server** (Ctrl+C in Terminal 1)
3. **Optional:** Delete Modal secret if you want
   ```bash
   modal secret delete tenkaigen-secrets
   ```

## Next Steps: Deploy to Cloudflare Workers

Once everything works locally:

1. Deploy Next.js to Cloudflare Workers
2. Get your production URL (e.g., `https://tenkaigen.workers.dev`)
3. Update Modal secret ONE TIME:
   ```bash
   modal secret create tenkaigen-secrets \
     TENKAIGEN_WEBHOOK_URL=https://tenkaigen.workers.dev/api/generate/webhook
   ```
4. Done! Works for all users permanently! 🚀

## Summary

✅ **Download ngrok** from ngrok.com  
✅ **Start dev server** (`npm run dev`)  
✅ **Start ngrok** (`ngrok http 3000`)  
✅ **Copy ngrok URL**  
✅ **Update Modal secret** with webhook URL  
✅ **Test generation** in designer  
✅ **Watch the magic!** ⚡🎨  

You're minutes away from seeing 10-second AI image generation working end-to-end! 🎉

