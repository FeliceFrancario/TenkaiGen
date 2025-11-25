#!/bin/bash

# Fast Printful Sync Cron Job
# This script runs the fast sync to keep the database updated

echo "🔄 Starting scheduled Printful sync at $(date)..."

# Replace with your actual Next.js app URL
APP_URL="http://localhost:3000"
SYNC_ENDPOINT="/api/sync/printful"
LOCALE="en_US"

# Trigger the sync
curl -X POST "${APP_URL}${SYNC_ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{\"locale\": \"${LOCALE}\"}" \
  --max-time 300 \
  --retry 3

if [ $? -eq 0 ]; then
  echo "✅ Sync completed successfully at $(date)"
else
  echo "❌ Sync failed at $(date)"
fi

# Optional: Update exchange rates
echo "🔄 Updating exchange rates..."
curl -X POST "${APP_URL}/api/exchange-rates" \
  --max-time 60 \
  --retry 2

echo "🏁 Cron job completed at $(date)"
