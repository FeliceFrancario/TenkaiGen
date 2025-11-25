const fetch = require('node-fetch');

async function triggerSync() {
  try {
    console.log('🔄 Triggering Printful sync...');
    
    const response = await fetch('http://localhost:3000/api/sync/printful', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ locale: 'en_US' })
    });
    
    const result = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', result);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

triggerSync();
