export type Product = {
  slug: string
  name: string
  variants: string[]
  image?: string
}

export const PRODUCTS: Product[] = [
  { slug: 't-shirts', name: 'T-Shirts', variants: ['Classic Tee', 'Oversized', 'Long Sleeve', 'Tank'] },
  { slug: 'hoodies', name: 'Hoodies', variants: ['Pullover Hoodie', 'Zip Hoodie', 'Lightweight Hoodie'] },
  { slug: 'totes', name: 'Totes', variants: ['Canvas Tote', 'Organic Tote'] },
  { slug: 'mugs', name: 'Mugs', variants: ['Ceramic Mug 11oz', 'Ceramic Mug 15oz'] },
  { slug: 'posters', name: 'Posters', variants: ['Matte Poster A3', 'Matte Poster A2'] },
  { slug: 'phone-cases', name: 'Phone Cases', variants: ['iPhone Case', 'Android Case'] },
  { slug: 'stickers', name: 'Stickers', variants: ['Glossy Sticker', 'Holographic Sticker'] },
  { slug: 'hats', name: 'Hats', variants: ['Baseball Cap', 'Beanie'] },
]

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug)
}
