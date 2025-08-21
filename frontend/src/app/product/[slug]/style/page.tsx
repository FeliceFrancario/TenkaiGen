import React from 'react'
import StyleClient from '@/components/flow/style-client'

export default function StylePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params)
  return <StyleClient slug={slug} />
}
