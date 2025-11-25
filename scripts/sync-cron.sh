#!/bin/bash

# Cron job script for updating Printful data and exchange rates
# Add this to your crontab:
# 0 2 * * * /path/to/this/script.sh

echo "🕐 Starting scheduled sync at $(date)"

# Set environment variables (adjust paths as needed)
export NODE_ENV=production
export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
export PRINTFUL_API_TOKEN="your_printful_api_token"

# Change to your project directory
cd /path/to/your/project

# Update exchange rates first
echo "📊 Updating exchange rates..."
curl -X POST "http://localhost:3000/api/exchange-rates" \
  -H "Content-Type: application/json" \
  || echo "❌ Failed to update exchange rates"

# Wait a bit before syncing products
sleep 5

# Sync Printful data
echo "🔄 Syncing Printful data..."
curl -X POST "http://localhost:3000/api/sync/printful" \
  -H "Content-Type: application/json" \
  -d '{"locale": "en_US"}' \
  || echo "❌ Failed to sync Printful data"

echo "✅ Scheduled sync completed at $(date)"
