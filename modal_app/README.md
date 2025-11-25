# TenkaiGen AI Image Generator - Modal Deployment

This directory contains the Modal deployment for the Qwen Nanchaku image generation model.

## Architecture

- **Model**: Qwen-Image with Nunchaku optimizations (int8 quantization, r32 rank)
- **GPU**: A10G (24GB VRAM) - good balance of performance and cost
- **Inference**: ~30-60 seconds per image at 50 steps
- **Storage**: Modal Volume for model caching

## Setup

### 1. Install Modal CLI

```bash
pip install modal
```

### 2. Authenticate with Modal

```bash
python -m modal setup
```

This will open a browser for authentication.

### 3. Create Modal Secrets

You need to create a secret named `tenkaigen-secrets` with:

```bash
modal secret create tenkaigen-secrets \
  TENKAIGEN_WEBHOOK_URL=https://your-domain.com/api/generate/webhook
```

Replace `your-domain.com` with your actual deployment URL (e.g., Vercel URL).

### 4. Deploy to Modal

```bash
modal deploy modal_app/qwen_generator.py
```

This will:
- Build the container image with all dependencies
- Download and cache the Qwen models
- Deploy the web endpoint
- Return a URL like: `https://username--tenkaigen-qwen-generator-generate-endpoint.modal.run`

### 5. Update Environment Variables

Add to your `frontend/.env.local`:

```env
MODAL_GENERATE_ENDPOINT=https://your-modal-url.modal.run
```

## Testing

### Local Test (requires Modal auth)

```bash
modal run modal_app/qwen_generator.py --prompt "A dragon flying over mountains"
```

This will generate an image and save it as `test_output.png`.

### Test the Web Endpoint

```bash
curl -X POST https://your-modal-url.modal.run \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test-123",
    "prompt": "A majestic phoenix rising from flames",
    "style": "Anime",
    "width": 1024,
    "height": 1024
  }'
```

## Monitoring

Monitor your Modal deployments at: https://modal.com/apps

You can see:
- Active containers
- GPU usage
- Request logs
- Costs

## Cost Optimization

**Current Configuration:**
- GPU: A10G (~$1.10/hour when active)
- Container idle timeout: 5 minutes (keeps warm)
- Typical generation: ~45 seconds
- Cost per image: ~$0.015

**To Reduce Costs:**
1. Switch to T4 GPU (slower but cheaper)
2. Use Lightning model (4-step, ~10 seconds)
3. Reduce idle timeout
4. Use spot instances

**To Improve Performance:**
1. Switch to A100 GPU (faster but more expensive)
2. Increase container idle timeout for faster responses
3. Use dedicated instances

## Switching to Lightning Model

For faster generation (4 steps vs 50 steps), uncomment the Lightning model sections in `qwen_generator.py`:

1. Update the `@modal.build()` method to download Lightning weights
2. Update the `@modal.enter()` method to use `FlowMatchEulerDiscreteScheduler`
3. Set `num_inference_steps=4` in the generate method

This will reduce generation time to ~10 seconds but with slightly lower quality.

## Production Considerations

1. **Monitoring**: Set up alerts for failed generations
2. **Rate Limiting**: Consider adding rate limits per user
3. **Queue Management**: Use Redis/Bull for job queuing if volume is high
4. **Caching**: Cache popular prompts/styles
5. **Batch Processing**: Process multiple prompts in parallel
6. **Image Optimization**: Add automatic compression for storage

## Troubleshooting

### OOM (Out of Memory) Errors

- Switch to A100 (40GB VRAM)
- Reduce max image size
- Enable more aggressive CPU offloading

### Slow Cold Starts

- Models are cached in Modal Volume
- First run after deploy takes ~2 minutes
- Subsequent runs: ~30 seconds cold start
- Warm containers: <1 second start

### Webhook Failures

- Check your webhook URL is publicly accessible
- Verify CORS if needed
- Check webhook logs in Next.js server

## Scaling

Modal automatically scales based on demand:
- 0 requests → 0 containers → $0
- Burst traffic → Auto-scales up
- Idle period → Scales down after timeout

For high sustained load, consider:
- Increasing concurrent container limit
- Using dedicated GPU instances
- Setting up multiple regions

