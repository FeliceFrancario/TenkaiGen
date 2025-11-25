"""
TenkaiGen AI Image Generator - Modal Deployment
Qwen Nanchaku Lightning model for ultra-fast print-on-demand designs
Uses 4-step generation for ~10 seconds per image (10x faster than standard)
"""
import io
import math
import os
import base64
from pathlib import Path
from typing import Optional

import modal

# Create Modal app
app = modal.App("tenkaigen-qwen-generator")

# Define the container image with all dependencies
# Ensure NumPy is installed BEFORE Nunchaku to satisfy build/import requirements
image = (
    # Follow Modal docs: use CUDA devel base and add_python so Python is detectable
    modal.Image.from_registry("nvidia/cuda:12.8.0-devel-ubuntu22.04", add_python="3.11").entrypoint([])
    .apt_install("git", "build-essential", "cmake", "ninja-build")
    .run_commands(
        "rm -f /root/.gitconfig",
        "git config --global url.'https://github.com/'.insteadOf git@github.com:",
        # Removed token URL rewrite to avoid corrupting Git URLs; public clone works
    )
    .pip_install(
        "numpy",
        "diffusers==0.35.2",
        "transformers==4.56.2",
        "accelerate==1.11.0",
        "safetensors==0.4.5",
        "Pillow==11.0.0",
        "fastapi[standard]==0.115.4",
        "pydantic==2.10.3",
        "requests==2.32.3",
        "huggingface_hub",
        "setuptools",
        "wheel",
        "ninja",
    )
    # Install PyTorch CUDA 12.8 wheels (match runtime GPUs). Install Nunchaku at runtime to match Torch version.
    .run_commands(
        "python -m pip install --upgrade pip setuptools wheel",
        "python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128",
    )
)

# GPU configuration - A10G is good balance of performance/cost
GPU_CONFIG = "A10G"

# Model will be cached in Modal volume for faster cold starts
model_volume = modal.Volume.from_name("qwen-models", create_if_missing=True)
MODEL_CACHE_PATH = "/cache/models"


@app.cls(
    image=image,
    gpu=GPU_CONFIG,
    timeout=900,  # allow longer startup for first-time runtime builds
    scaledown_window=300,  # Keep warm for 5 minutes
    volumes={MODEL_CACHE_PATH: model_volume},
    secrets=[modal.Secret.from_name("tenkaigen-secrets")],
)
class QwenGenerator:
    """
    Qwen Nanchaku Lightning Image Generator
    Uses 4-step Lightning model for ultra-fast generation (~10 seconds)
    Quality is excellent for print-on-demand designs
    """
    
    @modal.enter()
    def load_model(self):
        """Load model at container start. Prefer Nunchaku Lightning if available."""
        import torch
        from diffusers import QwenImagePipeline
        import os
        from huggingface_hub import hf_hub_download
        import importlib
        import subprocess
        import pkgutil
        import inspect

        def _import_nunchaku_qwen_transformer():
            """
            Robustly locate Nunchaku's QwenImage transformer across versions by:
            1) Trying known module paths
            2) Falling back to walking nunchaku package modules
            Returns the transformer class and a string describing the source module.
            """
            candidates = [
                "nunchaku.models.transformers.transformer_qwenimage",
                "nunchaku.models.transformers.transformer_qwen_image",
                "nunchaku.models.transformers.qwenimage",
                "nunchaku.models.transformers.qwen_image",
                "nunchaku.models.cv.transformers.qwenimage",
                "nunchaku.models.cv.transformers.qwen_image",
                "nunchaku.models.cv.transformers.transformer_qwenimage",
                "nunchaku.models.cv.transformers.transformer_qwen_image",
                "nunchaku.diffusers.models.transformers.qwenimage",
                "nunchaku.diffusers.models.transformers.qwen_image",
                "nunchaku.diffusers.transformers.qwenimage",
                "nunchaku.diffusers.transformers.qwen_image",
                "nunchaku.models.hub.transformers.qwenimage",
                "nunchaku.models.hub.transformers.qwen_image",
                "nunchaku.models.transformers",
                "nunchaku.models",
                "nunchaku.diffusers",
            ]
            class_names = [
                "NunchakuQwenImageTransformer2DModel",
                "QwenImageTransformer2DModel",
                "NunchakuQwenImageTransformer",
                "QwenImageTransformer",
                "NunchakuQwenImageModel",
            ]
            # Try direct imports first
            for mod_name in candidates:
                try:
                    mod = importlib.import_module(mod_name)
                    for cls_name in class_names:
                        if hasattr(mod, cls_name):
                            return getattr(mod, cls_name), mod_name
                except Exception:
                    pass
            # Walk the nunchaku package to discover the class dynamically
            try:
                import nunchaku  # type: ignore
                discovered = []
                print("🔎 Scanning nunchaku package for Qwen transformer classes...")
                for finder, name, ispkg in pkgutil.walk_packages(nunchaku.__path__, nunchaku.__name__ + "."):
                    try:
                        mod = importlib.import_module(name)
                    except Exception:
                        continue
                    for _, obj in inspect.getmembers(mod, inspect.isclass):
                        # Candidate if class name references qwen and transformer (image optional)
                        nm = obj.__name__.lower()
                        if "qwen" in nm and ("transform" in nm or "image" in nm):
                            discovered.append((obj, name))
                            # Prefer more specific names first
                            if "transform" in nm and ("image" in nm or "2d" in nm):
                                print(f"🔎 Found candidate class {obj.__name__} in {name}")
                                return obj, name
                # If we found anything, return the first discovered
                if discovered:
                    print(f"🔎 Using first discovered candidate {discovered[0][0].__name__} from {discovered[0][1]}")
                    return discovered[0]
                else:
                    # Log a subset of module names to help debugging
                    try:
                        import pkgutil as _pkg
                        mods = []
                        for _, mname, _ in _pkg.walk_packages(nunchaku.__path__, nunchaku.__name__ + "."):
                            if any(x in mname.lower() for x in ["qwen", "transform", "image"]):
                                mods.append(mname)
                                if len(mods) >= 20:
                                    break
                        print(f"📋 Nunchaku modules (sample): {mods}")
                    except Exception:
                        pass
            except Exception:
                pass
            raise ImportError("Unable to locate Nunchaku QwenImage transformer class in installed package")

        # Help PyTorch reduce fragmentation if we ever fall back
        os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

        enable_nunchaku = str(os.environ.get("ENABLE_NUNCHAKU", "0")).lower() in ("1", "true", "yes")
        if enable_nunchaku:
            # Try Nunchaku Lightning
            try:
                # Resolve transformer class dynamically
                NunchakuQwenImageTransformer2DModel, src_module = _import_nunchaku_qwen_transformer()
                from nunchaku.utils import get_precision
                from diffusers import FlowMatchEulerDiscreteScheduler
                print(f"🚀 Loading Qwen-Image Lightning (4-step) with Nunchaku from {src_module}...")
                scheduler_config = {
                    "base_image_seq_len": 256,
                    "base_shift": math.log(3),
                    "invert_sigmas": False,
                    "max_image_seq_len": 8192,
                    "max_shift": math.log(3),
                    "num_train_timesteps": 1000,
                    "shift": 1.0,
                    "shift_terminal": None,
                    "stochastic_sampling": False,
                    "time_shift_type": "exponential",
                    "use_beta_sigmas": False,
                    "use_dynamic_shifting": True,
                    "use_exponential_sigmas": False,
                    "use_karras_sigmas": False,
                }
                scheduler = FlowMatchEulerDiscreteScheduler.from_config(scheduler_config)
                rank = 32
                filename = f"svdq-{get_precision()}_r{rank}-qwen-image-lightningv1.0-4steps.safetensors"
                model_path = hf_hub_download(
                    repo_id="nunchaku-tech/nunchaku-qwen-image",
                    filename=filename,
                    cache_dir=MODEL_CACHE_PATH
                )
                print(f"📥 Loading transformer from: {model_path}")
                # Some versions expose from_single_file; fall back to from_pretrained
                try:
                    transformer = NunchakuQwenImageTransformer2DModel.from_single_file(model_path)  # type: ignore[attr-defined]
                except Exception:
                    transformer = NunchakuQwenImageTransformer2DModel.from_pretrained(model_path)
                self.pipe = QwenImagePipeline.from_pretrained(
                    "Qwen/Qwen-Image",
                    transformer=transformer,
                    scheduler=scheduler,
                    torch_dtype=torch.bfloat16,
                    cache_dir=MODEL_CACHE_PATH,
                    trust_remote_code=True,
                )
                # Prefer sequential offload for lower VRAM; exclude transformer if we have ample VRAM
                total_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                if total_vram_gb > 18:
                    try:
                        self.pipe._exclude_from_cpu_offload.append("transformer")
                    except Exception:
                        pass
                self.pipe.enable_sequential_cpu_offload()
                print("✅ Qwen-Image Lightning pipeline loaded! (~10-12s per image)")
                self._use_nunchaku = True
                return
            except Exception as e:
                print(f"⚠️ Nunchaku load failed: {e}. Attempting runtime install...")
                try:
                    env = os.environ.copy()
                    # Ensure CUDA 12.8 Torch (required by prebuilt Nunchaku wheel)
                    subprocess.check_call([
                        "python3", "-m", "pip", "install", "--upgrade",
                        "pip", "setuptools", "wheel", "ninja"
                    ], env=env)
                    subprocess.check_call([
                        "python3", "-m", "pip", "install",
                        "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cu128"
                    ], env=env)

                    # Choose a matching prebuilt Nunchaku wheel for current Torch major.minor
                    torch_version = torch.__version__.split("+")[0]
                    torch_mm = ".".join(torch_version.split(".")[:2])  # e.g., "2.9"
                    candidates = [
                        # Try newer releases first
                        f"https://github.com/nunchaku-tech/nunchaku/releases/download/v0.3.3/nunchaku-0.3.3+torch{torch_mm}-cp311-cp311-linux_x86_64.whl",
                        f"https://github.com/nunchaku-tech/nunchaku/releases/download/v0.3.2/nunchaku-0.3.2+torch{torch_mm}-cp311-cp311-linux_x86_64.whl",
                        f"https://github.com/nunchaku-tech/nunchaku/releases/download/v0.3.1/nunchaku-0.3.1+torch{torch_mm}-cp311-cp311-linux_x86_64.whl",
                    ]
                    last_err = None
                    for url in candidates:
                        try:
                            print(f"🔧 Trying Nunchaku wheel: {url}")
                            subprocess.check_call(["python3", "-m", "pip", "install", "--no-cache-dir", url], env=env)
                            last_err = None
                            break
                        except subprocess.CalledProcessError as perr:
                            last_err = perr
                            continue
                    if last_err is not None:
                        raise last_err

                    # Retry load after install with robust import fallbacks
                    try:
                        NunchakuQwenImageTransformer2DModel, src_module = _import_nunchaku_qwen_transformer()
                    except Exception as import_err_after_wheel:
                        # If the wheel doesn't include Qwen, build from source at a known commit
                        print(f"⚙️ Wheel missing Qwen transformer; building Nunchaku from source... ({import_err_after_wheel})")
                        # Configure CUDA build environment (A10G ~ sm_86)
                        env["CUDA_HOME"] = env.get("CUDA_HOME", "/usr/local/cuda")
                        env["TORCH_CUDA_ARCH_LIST"] = env.get("TORCH_CUDA_ARCH_LIST", "8.6")
                        env["CUDAARCHS"] = env.get("CUDAARCHS", "86")
                        env["MAX_JOBS"] = env.get("MAX_JOBS", "2")
                        # Known commit that includes QwenImage transformer
                        nunchaku_commit = "c01772562ab103d4958349250df626696d763d89"
                        subprocess.check_call([
                            "python3", "-m", "pip", "install", "--no-cache-dir", "--no-build-isolation",
                            f"git+https://github.com/nunchaku-tech/nunchaku.git@{nunchaku_commit}"
                        ], env=env)
                        # Try to import again after building from source
                        NunchakuQwenImageTransformer2DModel, src_module = _import_nunchaku_qwen_transformer()
                    from nunchaku.utils import get_precision
                    from diffusers import FlowMatchEulerDiscreteScheduler
                    print(f"✅ Nunchaku installed at runtime. Loading Lightning from {src_module}...")
                    scheduler_config = {
                        "base_image_seq_len": 256,
                        "base_shift": math.log(3),
                        "invert_sigmas": False,
                        "max_image_seq_len": 8192,
                        "max_shift": math.log(3),
                        "num_train_timesteps": 1000,
                        "shift": 1.0,
                        "shift_terminal": None,
                        "stochastic_sampling": False,
                        "time_shift_type": "exponential",
                        "use_beta_sigmas": False,
                        "use_dynamic_shifting": True,
                        "use_exponential_sigmas": False,
                        "use_karras_sigmas": False,
                    }
                    scheduler = FlowMatchEulerDiscreteScheduler.from_config(scheduler_config)
                    rank = 32
                    filename = f"svdq-{get_precision()}_r{rank}-qwen-image-lightningv1.0-4steps.safetensors"
                    model_path = hf_hub_download(
                        repo_id="nunchaku-tech/nunchaku-qwen-image",
                        filename=filename,
                        cache_dir=MODEL_CACHE_PATH
                    )
                    print(f"📥 Loading transformer from: {model_path}")
                    try:
                        transformer = NunchakuQwenImageTransformer2DModel.from_single_file(model_path)  # type: ignore[attr-defined]
                    except Exception:
                        transformer = NunchakuQwenImageTransformer2DModel.from_pretrained(model_path)
                    self.pipe = QwenImagePipeline.from_pretrained(
                        "Qwen/Qwen-Image",
                        transformer=transformer,
                        scheduler=scheduler,
                        torch_dtype=torch.bfloat16,
                        cache_dir=MODEL_CACHE_PATH,
                        trust_remote_code=True,
                    )
                    total_vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
                    if total_vram_gb > 18:
                        try:
                            self.pipe._exclude_from_cpu_offload.append("transformer")
                        except Exception:
                            pass
                    self.pipe.enable_sequential_cpu_offload()
                    print("✅ Qwen-Image Lightning pipeline loaded after runtime install")
                    self._use_nunchaku = True
                    return
                except Exception as ie:
                    print(f"⚠️ Runtime Nunchaku install failed: {ie}")

        # Fallback to standard pipeline
        print("🚀 Loading standard Qwen-Image pipeline (fallback)")
        self.pipe = QwenImagePipeline.from_pretrained(
            "Qwen/Qwen-Image",
            torch_dtype=torch.bfloat16,
            cache_dir=MODEL_CACHE_PATH,
            trust_remote_code=True,
        )
        self.pipe.enable_sequential_cpu_offload()
        self._use_nunchaku = False
        print("✅ Standard Qwen-Image pipeline loaded")
    
    @modal.method()
    def generate(
        self,
        prompt: str,
        style: Optional[str] = None,
        width: int = 1024,
        height: int = 1024,
        num_inference_steps: int = 12,  # Fallback default trimmed for speed; Lightning uses 4
        cfg_scale: float = 4.0,  # Lightning uses 1.0; standard uses higher CFG
        negative_prompt: str = " ",
        seed: Optional[int] = None,
    ) -> dict:
        """
        Generate an image from a prompt
        
        Args:
            prompt: The text description of the image to generate
            style: Optional style hint (Anime, Line Art, etc.)
            width: Output width (default 1664 for print quality)
            height: Output height (default 928 for print quality)
            num_inference_steps: Number of denoising steps (default 50)
            cfg_scale: Classifier-free guidance scale (default 4.0)
            negative_prompt: Things to avoid in generation
            seed: Random seed for reproducibility
            
        Returns:
            dict with 'image_base64' (base64 encoded PNG) and metadata
        """
        import torch
        from PIL import Image
        
        print(f"🎨 Generating image: {prompt[:100]}...")
        print(f"   Style: {style}, Size: {width}x{height}, Steps: {num_inference_steps}")
        
        # Set random seed if provided
        if seed is not None:
            torch.manual_seed(seed)
        
        # Enhance prompt based on style
        enhanced_prompt = self._enhance_prompt(prompt, style)
        
        # Generate image
        try:
            # Use true_cfg for Lightning, guidance_scale for standard
            call_kwargs = dict(
                prompt=enhanced_prompt,
                negative_prompt=negative_prompt,
                width=width,
                height=height,
            )
            if getattr(self, "_use_nunchaku", False):
                call_kwargs["num_inference_steps"] = num_inference_steps if num_inference_steps else 4
                call_kwargs["true_cfg_scale"] = cfg_scale if cfg_scale is not None else 1.0
            else:
                call_kwargs["num_inference_steps"] = num_inference_steps if num_inference_steps else 30
                call_kwargs["guidance_scale"] = cfg_scale if cfg_scale is not None else 4.0

            result = self.pipe(**call_kwargs)
            
            image = result.images[0]
            
            # Convert to base64 for transport
            buffer = io.BytesIO()
            image.save(buffer, format="PNG", optimize=True)
            image_bytes = buffer.getvalue()
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            print(f"✅ Generated image: {len(image_bytes)} bytes")
            
            return {
                "success": True,
                "image_base64": image_base64,
                "metadata": {
                    "prompt": prompt,
                    "enhanced_prompt": enhanced_prompt,
                    "style": style,
                    "width": width,
                    "height": height,
                    "steps": num_inference_steps,
                    "cfg_scale": cfg_scale,
                    "nunchaku": getattr(self, "_use_nunchaku", False),
                }
            }
            
        except Exception as e:
            print(f"❌ Generation failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _enhance_prompt(self, prompt: str, style: Optional[str]) -> str:
        """
        Enhance prompt with style-specific additions
        
        The LLM already expanded the prompt, but we can add
        quality boosters and style-specific tags here
        """
        
        # Base quality enhancer for all styles
        quality_magic = "Ultra HD, 4K, cinematic composition"
        
        # Style-specific enhancements
        style_enhancements = {
            "Anime": ", vibrant colors, detailed shading, anime art style, high quality illustration",
            "Line Art": ", clean lines, minimalist design, vector art style, simple elegant composition",
            "Flat Logo": ", flat design, bold shapes, modern minimalist logo, clean vector graphics",
            "Watercolor": ", watercolor painting style, soft blending, artistic brush strokes, delicate colors",
            "Abstract": ", abstract art, geometric shapes, modern composition, bold colors",
            "Minimalist": ", minimalist design, simple clean composition, negative space, elegant simplicity",
            "Vintage": ", vintage art style, retro aesthetic, aged texture, classic design",
            "Grunge": ", grunge texture, distressed style, urban aesthetic, rough edges",
            "Standard": ", professional design, balanced composition, high quality"
        }
        
        enhancement = style_enhancements.get(style, style_enhancements["Standard"])
        
        return f"{prompt}{enhancement}. {quality_magic}."


# Background processor to avoid HTTP timeouts
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("tenkaigen-secrets")],
    timeout=1200,  # Allow ample time for first cold start and generation
)
def process_job(job_id: str, prompt: str, style, width: int, height: int, seed):
    import time
    import requests
    import os as _os

    start_time = time.time()
    webhook_url = _os.environ.get("TENKAIGEN_WEBHOOK_URL")

    generator = QwenGenerator()
    result = generator.generate.remote(
        prompt=prompt,
        style=style,
        width=width,
        height=height,
        seed=seed,
        # Use Lightning defaults when available
            num_inference_steps=4 if getattr(generator, "_use_nunchaku", False) else 12,
        cfg_scale=1.0 if getattr(generator, "_use_nunchaku", False) else 4.0,
    )

    processing_time_ms = int((time.time() - start_time) * 1000)

    if webhook_url:
        payload = {
            "job_id": job_id,
            "processing_time_ms": processing_time_ms,
        }
        if result["success"]:
            payload.update({
                "status": "completed",
                "image_base64": result["image_base64"],
                "metadata": result["metadata"],
            })
        else:
            payload.update({
                "status": "failed",
                "error": result.get("error", "Unknown error"),
            })
        try:
            requests.post(webhook_url, json=payload, timeout=30)
        except Exception as _e:
            print(f"❌ Webhook error for job {job_id}: {_e}")
    else:
        print("⚠️ TENKAIGEN_WEBHOOK_URL not configured, skipping webhook")

    return {"success": True}

# FastAPI web endpoint
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("tenkaigen-secrets")],
    timeout=900,  # 15 minutes max
)
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI, Request
    
    web_app = FastAPI()
    
    @web_app.get("/")
    async def healthcheck():
        return {"ok": True}
    
    @web_app.post("/")
    async def generate_endpoint_handler(request: Request):
        """
        Web endpoint for image generation
        
        POST / with JSON body:
        {
            "job_id": "uuid",  // required - job ID from database
            "prompt": "...",
            "style": "Anime",  // optional
            "width": 1664,     // optional
            "height": 928,     // optional
            "seed": 12345      // optional
        }
        
        Calls webhook at completion to report results
        """
        import time
        import requests
        
        start_time = time.time()
        
        # Parse request body safely
        try:
            body = await request.json()
        except Exception:
            return {"success": False, "error": "Invalid JSON body"}
        
        # Extract parameters
        job_id = body.get("job_id", "")
        prompt = body.get("prompt", "")
        style = body.get("style")
        width = body.get("width", 1664)
        height = body.get("height", 928)
        seed = body.get("seed")
        
        webhook_url = os.environ.get("TENKAIGEN_WEBHOOK_URL")
        
        if not job_id:
            return {
                "success": False,
                "error": "job_id is required"
            }
        
        if not prompt:
            # Report failure to webhook
            if webhook_url:
                requests.post(webhook_url, json={
                    "job_id": job_id,
                    "status": "failed",
                    "error": "Prompt is required"
                })
            return {
                "success": False,
                "error": "Prompt is required"
            }
        
        print(f"🎨 Starting generation for job {job_id}")
        
        # Spawn background worker to avoid HTTP timeouts
        process_job.spawn(job_id, prompt, style, width, height, seed)
        
        # Respond immediately; webhook will deliver results
        return {"success": True, "job_id": job_id}
    
    return web_app


# CLI command for local testing
@app.local_entrypoint()
def main(prompt: str = "A majestic dragon flying over mountains at sunset"):
    """Test generation locally"""
    generator = QwenGenerator()
    result = generator.generate.remote(
        prompt=prompt,
        style="Standard",
        width=1024,
        height=1024,
        num_inference_steps=30  # Faster for testing
    )
    
    if result["success"]:
        # Save image locally
        import base64
        from PIL import Image
        
        image_data = base64.b64decode(result["image_base64"])
        image = Image.open(io.BytesIO(image_data))
        image.save("test_output.png")
        print(f"✅ Saved to test_output.png")
        print(f"Metadata: {result['metadata']}")
    else:
        print(f"❌ Failed: {result['error']}")

