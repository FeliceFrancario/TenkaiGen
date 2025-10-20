import { NextRequest, NextResponse } from 'next/server'

const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY
const PRINTFUL_BASE_URL = 'https://api.printful.com'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, variantId, styleIds, placement } = body
    
    if (!productId || !styleIds || !Array.isArray(styleIds)) {
      return NextResponse.json({
        success: false,
        error: 'productId and styleIds array are required'
      }, { status: 400 })
    }
    
    console.log(`🖼️ Fetching images for product ${productId}, variant ${variantId}, placement ${placement}, styles: ${styleIds.join(', ')}`)
    
    const images = []
    
    // Fetch images for each style ID
    for (const styleId of styleIds) {
      try {
        let imageUrl = ''
        
        if (variantId) {
          // Fetch variant-specific images
          const variantResponse = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-variants/${variantId}/images`, {
            headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
          })
          
          if (variantResponse.ok) {
            const variantData = await variantResponse.json()
            const variantImages = variantData?.data || []
            
            // Find image for the specific placement and style
            for (const variantImage of variantImages) {
              for (const image of variantImage.images || []) {
                if (image.placement === placement) {
                  imageUrl = image.image_url
                  break
                }
              }
              if (imageUrl) break
            }
          }
        }
        
        // If no variant image found, try product-level images
        if (!imageUrl) {
          const productResponse = await fetch(`${PRINTFUL_BASE_URL}/v2/catalog-products/${productId}/images`, {
            headers: { 'Authorization': `Bearer ${PRINTFUL_API_KEY}` }
          })
          
          if (productResponse.ok) {
            const productData = await productResponse.json()
            const productImages = productData?.data || []
            
            // Find image for the specific placement and style
            for (const productImage of productImages) {
              for (const image of productImage.images || []) {
                if (image.placement === placement) {
                  imageUrl = image.image_url
                  break
                }
              }
              if (imageUrl) break
            }
          }
        }
        
        if (imageUrl) {
          images.push({
            styleId,
            imageUrl,
            placement
          })
        }
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.log(`⚠️ Error fetching image for style ${styleId}:`, error)
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        images,
        total: images.length
      }
    })
    
  } catch (error) {
    console.error('Images API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
