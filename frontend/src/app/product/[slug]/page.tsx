import React from 'react'
import ProductClient from '@/components/flow/product-client'

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params)
  return <ProductClient slug={slug} />
}
