import { createServiceClient } from './database'

export type PricingResult = {
  retailPrice: number
  currency: string
  markupApplied: number
  exchangeRateUsed: number
  includesDesign: boolean
}

// Get exchange rate for a currency
export async function getExchangeRate(currency: string): Promise<number> {
  // Returns USD->currency multiplier for conversion (e.g., USD->EUR)
  if (currency === 'USD') return 1.0
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('rate_to_usd, usd_to_currency')
    .eq('currency', currency)
    .maybeSingle()
  if (error || !data) {
    console.warn(`Exchange rate not found for ${currency}, using 1.0`)
    return 1.0
  }
  const usdToCurrency = Number(data.usd_to_currency)
  const rateToUsd = Number(data.rate_to_usd)
  if (Number.isFinite(usdToCurrency) && usdToCurrency > 0) return usdToCurrency
  if (Number.isFinite(rateToUsd) && rateToUsd > 0) return 1 / rateToUsd
  return 1.0
}

// Get pricing rule for a product and currency
export async function getPricingRule(productId: string, currency: string): Promise<{
  markupType: 'percentage' | 'fixed'
  markupValue: number
  retailPrice?: number
} | null> {
  const supabase = await createServiceClient()
  
  // First try to get product-specific rule
  const { data: productRule, error: productError } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('product_id', productId)
    .eq('currency', currency)
    .single()
  
  if (!productError && productRule) {
    return {
      markupType: productRule.markup_type,
      markupValue: productRule.markup_value,
      retailPrice: productRule.retail_price || undefined
    }
  }
  
  // Fallback to default rule (no product_id)
  const { data: defaultRule, error: defaultError } = await supabase
    .from('pricing_rules')
    .select('*')
    .is('product_id', null)
    .eq('currency', currency)
    .single()
  
  if (!defaultError && defaultRule) {
    return {
      markupType: defaultRule.markup_type,
      markupValue: defaultRule.markup_value,
      retailPrice: defaultRule.retail_price || undefined
    }
  }
  
  // Ultimate fallback: 60% profit margin (cost is 40% of selling price)
  // Formula: selling_price = base_cost / 0.40 = base_cost * 2.5
  return {
    markupType: 'percentage',
    markupValue: 150  // 150% markup = 60% margin
  }
}

// Calculate retail price from base USD price
export async function calculateRetailPrice(
  basePriceUsd: number,
  targetCurrency: string,
  productId?: string
): Promise<PricingResult> {
  try {
    // Get exchange rate
    const exchangeRate = await getExchangeRate(targetCurrency)
    
    // Get pricing rule
    const pricingRule = await getPricingRule(productId || '', targetCurrency)
    
    if (!pricingRule) {
      throw new Error('No pricing rule found')
    }
    
    let retailPrice: number
    
    // If retail price is explicitly set, use it
    if (pricingRule.retailPrice) {
      retailPrice = pricingRule.retailPrice
    } else {
      // Calculate based on markup
      // Enforce minimum 150% markup (60% profit margin)
      const effectivePct = Math.max(pricingRule.markupType === 'percentage' ? pricingRule.markupValue : 0, 150)
      const fixed = pricingRule.markupType === 'fixed' ? pricingRule.markupValue : 0
      const pctAmount = basePriceUsd * (effectivePct / 100)
      retailPrice = basePriceUsd + Math.max(pctAmount, 0) + fixed
    }
    
    // Convert to target currency
    const finalPrice = retailPrice * exchangeRate

    // Clean rounding: round to .00 or .99 (psychological pricing)
    const rounded = Math.round(finalPrice * 100) / 100
    const cents = Math.round((rounded - Math.floor(rounded)) * 100)
    const clean = cents === 0 ? rounded : Math.floor(rounded) + 0.99
    
    return {
      retailPrice: Number(clean.toFixed(2)),
      currency: targetCurrency,
      markupApplied: pricingRule.markupValue,
      exchangeRateUsed: exchangeRate,
      includesDesign: true
    }
  } catch (error) {
    console.error('Error calculating retail price:', error)
    
    // Fallback: simple conversion with 150% markup (60% profit margin)
    const exchangeRate = await getExchangeRate(targetCurrency)
    const markupPrice = basePriceUsd * 2.50  // 150% markup
    const finalPrice = markupPrice * exchangeRate
    const rounded = Math.round(finalPrice * 100) / 100
    const cents = Math.round((rounded - Math.floor(rounded)) * 100)
    const clean = cents === 0 ? rounded : Math.floor(rounded) + 0.99
    
    return {
      retailPrice: Number(clean.toFixed(2)),
      currency: targetCurrency,
      markupApplied: 150,
      exchangeRateUsed: exchangeRate,
      includesDesign: true
    }
  }
}

// Format price for display
export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  } catch (error) {
    // Fallback formatting
    return `${currency} ${amount.toFixed(2)}`
  }
}

// Get products with calculated prices
export async function getProductsWithPricing(
  categoryId?: string,
  currency: string = 'USD',
  limit: number = 24,
  offset: number = 0
) {
  const supabase = await createServiceClient()
  
  let query = supabase
    .from('products')
    .select(`
      *,
      categories!inner(name, slug),
      variants(base_price_usd, size, color, image_url),
      images!inner(url, type, gender)
    `)
    .eq('images.type', 'thumbnail')
    .range(offset, offset + limit - 1)
  
  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }
  
  const { data: products, error } = await query
  
  if (error) {
    console.error('Error fetching products:', error)
    return []
  }
  
  // Calculate prices for each product
  const productsWithPricing = await Promise.all(
    products.map(async (product) => {
      const pricing = await calculateRetailPrice(
        product.base_price_usd,
        currency,
        product.id
      )
      
      return {
        ...product,
        retailPrice: pricing.retailPrice,
        currency: pricing.currency,
        formattedPrice: formatPrice(pricing.retailPrice, pricing.currency),
        markupApplied: pricing.markupApplied,
        exchangeRateUsed: pricing.exchangeRateUsed
      }
    })
  )
  
  return productsWithPricing
}
