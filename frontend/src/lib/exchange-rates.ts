import { createServiceClient } from './database'

// Update exchange rates from external API
export async function updateExchangeRates(): Promise<void> {
  console.log('🔄 Updating exchange rates...')
  
  try {
    // Using a free exchange rate API (you can replace with a paid service for better accuracy)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    
    if (!response.ok) {
      throw new Error(`Exchange rate API failed: ${response.status}`)
    }
    
    const data = await response.json()
    const rates = data.rates
    
    console.log(`📊 Fetched exchange rates for ${Object.keys(rates).length} currencies`)
    
    // Update rates in database
    const updates = Object.entries(rates).map(([currency, rate]) => ({
      currency,
      rate_to_usd: rate as number,
      last_updated: new Date().toISOString()
    }))
    
    // Upsert exchange rates
    const supabase = await createServiceClient()
    const { error } = await supabase
      .from('exchange_rates')
      .upsert(updates, {
        onConflict: 'currency'
      })
    
    if (error) {
      console.error('Error updating exchange rates:', error)
      throw error
    }
    
    console.log('✅ Exchange rates updated successfully')
  } catch (error) {
    console.error('❌ Failed to update exchange rates:', error)
    throw error
  }
}

// Get current exchange rates
export async function getCurrentExchangeRates() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .order('currency')
  
  if (error) {
    console.error('Error fetching exchange rates:', error)
    return []
  }
  
  return data
}
