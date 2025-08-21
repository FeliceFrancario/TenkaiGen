import React from 'react'
import PromptClient from '@/components/flow/prompt-client'

export default async function PromptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <PromptClient slug={slug} />
}
