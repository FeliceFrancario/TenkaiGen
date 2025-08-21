export type Product = {
  slug: string
  name: string
  variants: string[]
  image?: string
  colors?: string[]
  printAreas?: ('Front' | 'Back')[]
  sizes?: string[]
}

export const PRODUCTS: Product[] = [
  {
    slug: 't-shirts',
    name: 'T-Shirts',
    variants: ['Classic Tee', 'Oversized', 'Long Sleeve', 'Tank'],
    colors: ['Black', 'White', 'Navy', 'Heather Gray'],
    printAreas: ['Front', 'Back'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL']
  },
  {
    slug: 'hoodies',
    name: 'Hoodies',
    variants: ['Pullover Hoodie', 'Zip Hoodie', 'Lightweight Hoodie'],
    colors: ['Black', 'White', 'Navy', 'Heather Gray'],
    printAreas: ['Front', 'Back'],
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL']
  },
  {
    slug: 'totes',
    name: 'Totes',
    variants: ['Canvas Tote', 'Organic Tote'],
    colors: ['Black', 'Natural', 'Beige'],
    printAreas: ['Front'],
  },
  {
    slug: 'mugs',
    name: 'Mugs',
    variants: ['Ceramic Mug 11oz', 'Ceramic Mug 15oz'],
    colors: ['White'],
    printAreas: ['Front'],
  },
  {
    slug: 'posters',
    name: 'Posters',
    variants: ['Matte Poster A3', 'Matte Poster A2'],
    printAreas: ['Front'],
    sizes: ['A3', 'A2']
  },
  {
    slug: 'phone-cases',
    name: 'Phone Cases',
    variants: ['iPhone Case', 'Android Case'],
    colors: ['Black', 'White', 'Transparent'],
    printAreas: ['Front'],
  },
  {
    slug: 'stickers',
    name: 'Stickers',
    variants: ['Glossy Sticker', 'Holographic Sticker'],
    printAreas: ['Front'],
  },
  {
    slug: 'hats',
    name: 'Hats',
    variants: ['Baseball Cap', 'Beanie'],
    colors: ['Black', 'Navy', 'Beige'],
    printAreas: ['Front'],
    sizes: ['One Size']
  },
]

export function getProductBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug)
}
