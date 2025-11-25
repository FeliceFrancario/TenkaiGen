#!/usr/bin/env node

/**
 * Quick test script to check generation job status
 * Usage: node test-job-status.js <job_id>
 */

const jobId = process.argv[2] || '149807f8-cad9-4e88-b6b1-85da18cf289c'

async function checkJobStatus() {
  try {
    const url = `http://localhost:3000/api/generate/status/${jobId}`
    console.log(`\n🔍 Checking job status for: ${jobId}`)
    console.log(`📡 URL: ${url}\n`)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
      const text = await response.text()
      console.error('Response:', text)
      return
    }
    
    const data = await response.json()
    
    console.log('📊 Job Status:')
    console.log('─'.repeat(60))
    console.log(`  Job ID:          ${data.jobId}`)
    console.log(`  Status:          ${data.status}`)
    console.log(`  Result URL:      ${data.resultUrl || 'N/A'}`)
    console.log(`  Error:           ${data.error || 'N/A'}`)
    console.log(`  Processing Time: ${data.processingTimeMs ? `${data.processingTimeMs}ms` : 'N/A'}`)
    console.log(`  Created At:      ${data.createdAt}`)
    console.log(`  Completed At:    ${data.completedAt || 'N/A'}`)
    console.log('─'.repeat(60))
    
    if (data.status === 'completed') {
      console.log('\n✅ Generation completed successfully!')
      console.log(`🖼️  Image URL: ${data.resultUrl}`)
    } else if (data.status === 'failed') {
      console.log('\n❌ Generation failed!')
      console.log(`📝 Error: ${data.error}`)
    } else if (data.status === 'processing') {
      console.log('\n⏳ Generation is still processing...')
    } else if (data.status === 'queued') {
      console.log('\n⏳ Job is queued and waiting to be processed')
      console.log('\n💡 If stuck in "queued" for >2 minutes, check:')
      console.log('   1. Modal deployment status')
      console.log('   2. Modal secret TENKAIGEN_WEBHOOK_URL')
      console.log('   3. Modal logs: modal app logs tenkaigen-qwen-generator')
    }
    
    if (data.metadata) {
      console.log('\n📋 Metadata:')
      console.log(JSON.stringify(data.metadata, null, 2))
    }
    
  } catch (error) {
    console.error('\n❌ Error checking job status:', error.message)
    console.error('\n💡 Make sure:')
    console.error('   1. Next.js dev server is running (npm run dev)')
    console.error('   2. You are using the correct job ID')
  }
}

checkJobStatus()

