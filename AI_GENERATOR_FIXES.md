# AI Generator Fixes - October 27, 2025

## Issue: Modal Container Failing on Deployment

### Problem Identified

The Modal container was failing with "1 error" status because the Hugging Face model loading requires `git` to clone repositories, but the Modal image didn't have `git` installed.

**Error Location:** Line 103 in `modal_app/qwen_generator.py`
```python
self.pipe = QwenImagePipeline.from_pretrained(
    "Qwen/Qwen-Image",  # This requires git to clone from Hugging Face
    scheduler=self.scheduler,
    torch_dtype=torch.bfloat16,
    cache_dir=MODEL_CACHE_PATH
)
```

### Symptoms

1. **Frontend**: Endless polling of `/api/generate/status/[jobId]` with `status: 'queued'`
2. **Modal Dashboard**: Container shows "Failed" status with "1 error"
3. **Backend**: Job never completes because Modal never successfully generates the image

### Root Cause

When `diffusers` and `transformers` try to load models from Hugging Face Hub using repository IDs (like `"Qwen/Qwen-Image"`), they use `git` under the hood to clone the model repository. The Modal container didn't have `git` installed, causing the model loading to fail.

## Solution Applied

### Fix: Install Git in Modal Image

Updated `modal_app/qwen_generator.py` to install `git` and configure it for HTTPS:

```python
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")  # Required for Hugging Face model loading
    .run_commands(
        # Configure git to use HTTPS instead of SSH for public repos
        "git config --global url.'https://github.com/'.insteadOf git@github.com:"
    )
    .pip_install(
        # ... all dependencies
    )
)
```

**What this does:**
1. `.apt_install("git")` - Installs git in the container
2. `.run_commands(...)` - Configures git to use HTTPS for GitHub (no SSH keys needed)

### Deployment Command

```bash
cd modal_app
modal deploy qwen_generator.py
```

This will:
1. Build a new container image with git installed
2. Deploy the updated Modal app
3. Take ~2-3 minutes for first deployment (downloads models)

## Testing After Fix

### 1. Wait for Deployment

Check deployment status:
```bash
modal app list
```

You should see `tenkaigen-qwen-generator` listed.

### 2. Test Generation

**In the designer page:**
1. Enter prompt: "A majestic phoenix with blue flames"
2. Select style: "Anime"
3. Click "Generate"
4. **Expected**: Image appears in ~12-14 seconds ✅

### 3. Watch the Logs

**Terminal 1 (Next.js):**
```
[api/generate] Created job abc-123-def
[webhook] Received result for job abc-123-def
[webhook] Uploaded to B2
[webhook] Updated job status to completed
```

**Terminal 2 (ngrok):**
```
POST /api/generate        200 OK
POST /api/generate/webhook 200 OK  ← This means Modal successfully called back!
```

**Modal Dashboard:**
- Container status: "Running" ✅
- No errors ✅

## Why This Happened

This is a common gotcha with Hugging Face models on containerized platforms:

1. **Local development**: Git is usually already installed on your machine
2. **Modal containers**: Start from minimal Debian images with no git
3. **Hugging Face Hub**: Uses git clone for repository-based models
4. **Result**: Silent failure when git is missing

## Alternative Approach (If This Doesn't Work)

If you still encounter issues, we can switch to downloading the model files directly instead of using repository IDs:

```python
# Instead of:
pipe = QwenImagePipeline.from_pretrained("Qwen/Qwen-Image", ...)

# Use direct file downloads:
from huggingface_hub import hf_hub_download
model_files = [
    "config.json",
    "model.safetensors",
    # ... etc
]
for file in model_files:
    hf_hub_download(repo_id="Qwen/Qwen-Image", filename=file, cache_dir=MODEL_CACHE_PATH)
```

But the git approach is cleaner and more maintainable.

## Related Issues Fixed

### Issue: AttributeError with `@modal.build()`

**Already fixed in previous version** - Changed from deprecated `@modal.build()` to `@modal.enter()`:

```python
# Old (deprecated):
@modal.build()
def build():
    ...

# New (correct):
@modal.enter()
def load_model(self):
    ...
```

### Issue: `container_idle_timeout` Deprecated

**Already fixed** - Changed to `scaledown_window`:

```python
# Old:
container_idle_timeout=300

# New:
scaledown_window=300
```

## Current Status

✅ Git installed in Modal image  
✅ Git configured for HTTPS (no SSH keys needed)  
✅ Deployment command executed  
⏳ Waiting for deployment to complete (~2-3 minutes)  
⏳ Testing generation flow  

## Next Steps

1. **Wait 2-3 minutes** for Modal deployment to complete
2. **Test generation** in the designer page
3. **Verify webhook** is being called (check ngrok logs)
4. **Confirm image appears** in the designer

If the issue persists after this fix, check:
- Modal dashboard for container logs
- ngrok inspector at http://localhost:4040
- Browser console for frontend errors

## Deployment Timeline

**First deployment:** ~5-10 minutes (downloads 4GB+ of models)  
**Subsequent deployments:** ~2-3 minutes (models cached in volume)  
**Cold start (first generation):** ~30 seconds (loads model into GPU memory)  
**Warm generation:** ~10-12 seconds (Lightning 4-step model)  

The wait is worth it for that sweet 10-second AI image generation! 🚀
