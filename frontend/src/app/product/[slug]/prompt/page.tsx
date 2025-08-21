import React from 'react'
import PromptClient from '@/components/flow/prompt-client'

export default function PromptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = React.use(params)
  return <PromptClient slug={slug} />
}
