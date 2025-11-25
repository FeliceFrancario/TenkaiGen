# TenkaiGen AI Generator - Quick Start

## 🚀 Get Running in 10 Minutes

### Step 1: Database (2 minutes)

Go to Supabase Dashboard → SQL Editor:

```sql
-- Copy and paste entire contents of:
-- supabase/migrations/015_create_generation_jobs_table.sql
```

Click **Run**. This creates the `generation_jobs` table and storage bucket.

### Step 2: Modal Setup (3 minutes)

```bash
# Install and authenticate
pip install modal
python -m modal setup
# Browser will open - follow prompts

# Create secret (replace YOUR_URL with your Vercel/Railway URL)
modal secret create tenkaigen-secrets \
  TENKAIGEN_WEBHOOK_URL=https://YOUR_URL.com/api/generate/webhook
```

### Step 3: Deploy to Modal (5 minutes)

```bash
cd modal_app
modal deploy qwen_generator.py
```

Wait for deployment. Copy the URL that looks like:
```
https://username--tenkaigen-qwen-generator-generate-endpoint.modal.run
```

### Step 4: Configure Next.js (1 minute)

Add to `frontend/.env.local`:

```env
MODAL_GENERATE_ENDPOINT=https://YOUR-MODAL-URL.modal.run
GEMINI_API_KEY=your_gemini_api_key_here
```

Restart your Next.js server:
```bash
cd frontend
npm run dev
```

## ✅ Test It

```bash
# Quick test (requires Modal auth)
modal run modal_app/qwen_generator.py --prompt "A dragon"
# Creates test_output.png

# Full API test
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A cyberpunk samurai",
    "style": "Anime"
  }'
```

## 🎨 Use It

1. Log in to your app
2. Enter prompt in hero: *"A phoenix rising from flames"*
3. Select **Anime** style
4. Choose a product
5. Wait ~45 seconds
6. Design appears in designer!

## 📊 Monitor

- **Modal**: https://modal.com/apps
- **Supabase**: Check `generation_jobs` table
- **Logs**: Next.js console for API calls

## 💰 Costs

- ~$0.015 per image (A10G GPU)
- ~$15 for 1,000 images/month
- First $10/month free on Modal

## 🐛 Troubleshooting

**"Not authenticated"** → Run `python -m modal setup`

**"MODAL_GENERATE_ENDPOINT not configured"** → Add to `.env.local` and restart

**"Job stuck in queued"** → Check Modal logs at https://modal.com/apps

**"Webhook failed"** → Verify webhook URL in Modal secret matches your deployed URL

## 📚 Full Documentation

- **Setup Guide**: `AI_GENERATOR_SETUP.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Modal Guide**: `modal_app/README.md`

## 🎯 What's Included

✅ Qwen Nanchaku model on A10G GPU
✅ 9 style presets (Anime, Line Art, Watercolor, etc.)
✅ Job tracking & status polling
✅ Secure image storage
✅ Webhook integration
✅ Error handling
✅ Cost optimization

## 🚀 Next Steps

After basic setup works:
1. Switch to Lightning model for 5x speed
2. Add franchise LoRAs (One Piece, Naruto, etc.)
3. Implement image-to-image
4. Add batch processing
5. Set up monitoring alerts

**You're ready to generate AI designs!** 🎉

