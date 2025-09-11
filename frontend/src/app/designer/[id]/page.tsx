import { headers } from 'next/headers'
import DesignerPage from '@/components/designer-page'

export const dynamic = 'force-dynamic'

async function absoluteUrl(path: string) {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return `${proto}://${host}${path}`
}

export default async function DesignerRoute({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<Record<string, string>> }) {
  const { id } = await params
  const sp = await searchParams
  // Fetch minimal product info to validate existence
  const res = await fetch(await absoluteUrl(`/api/printful/product?product_id=${encodeURIComponent(id)}`), { cache: 'no-store' })
  const data = res.ok ? await res.json() : null
  const product = data?.result || null
  return <DesignerPage productId={Number(id)} product={product} initialSearch={sp} />
}
