#!/bin/bash

# TenkaiGen Modal Deployment Script

set -e  # Exit on error

echo "🚀 TenkaiGen AI Generator Deployment"
echo "===================================="
echo ""

# Check if modal is installed
if ! command -v modal &> /dev/null; then
    echo "❌ Modal CLI not found. Installing..."
    pip install modal
fi

# Check if authenticated
echo "📝 Checking Modal authentication..."
if ! modal token list &> /dev/null; then
    echo "❌ Not authenticated with Modal. Running setup..."
    python -m modal setup
fi

echo "✅ Modal authenticated"
echo ""

# Check if secret exists
echo "🔐 Checking for tenkaigen-secrets..."
if modal secret list | grep -q "tenkaigen-secrets"; then
    echo "✅ Secret exists"
else
    echo "❌ Secret 'tenkaigen-secrets' not found"
    echo ""
    echo "Please create the secret with:"
    echo "  modal secret create tenkaigen-secrets \\"
    echo "    TENKAIGEN_WEBHOOK_URL=https://your-domain.com/api/generate/webhook"
    echo ""
    exit 1
fi

echo ""
echo "🏗️  Building and deploying to Modal..."
echo "This may take 5-10 minutes on first deploy..."
echo ""

# Deploy
modal deploy qwen_generator.py

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the endpoint URL shown above"
echo "2. Add to frontend/.env.local:"
echo "   MODAL_GENERATE_ENDPOINT=https://your-url.modal.run"
echo "3. Restart your Next.js server"
echo ""
echo "🧪 To test locally:"
echo "   modal run qwen_generator.py --prompt 'A majestic dragon'"
echo ""
echo "📊 Monitor at: https://modal.com/apps"

