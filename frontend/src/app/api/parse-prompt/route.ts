import { NextResponse } from 'next/server'
import { PRODUCTS } from '@/lib/data'
import { z } from 'zod'
import { STYLES } from '@/lib/styles'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'

export const runtime = 'nodejs'

const KEYWORDS: Record<string, string[]> = {
  't-shirts': ['t-shirt', 'tee', 'shirt', 'tshirt', 't shirt'],
  'hoodies': ['hoodie', 'sweatshirt', 'pullover', 'zip hoodie'],
  'totes': ['tote', 'bag', 'tote bag'],
  'mugs': ['mug', 'cup', 'coffee mug'],
  'posters': ['poster', 'print', 'wall art'],
  'phone-cases': ['phone case', 'iphone case', 'android case', 'case'],
  'stickers': ['sticker', 'stickers', 'decal'],
  'hats': ['hat', 'cap', 'beanie'],
}

function detectProduct(prompt: string): { slug: string; name: string } | null {
  const p = prompt.toLowerCase()
  // direct match by product name
  for (const prod of PRODUCTS) {
    if (p.includes(prod.name.toLowerCase())) return { slug: prod.slug, name: prod.name }
  }
  // keyword map
  for (const [slug, words] of Object.entries(KEYWORDS)) {
    for (const w of words) {
      if (p.includes(w)) {
        const prod = PRODUCTS.find((x) => x.slug === slug)
        if (prod) return { slug: prod.slug, name: prod.name }
      }
    }
  }
  return null
}

export async function POST(req: Request) {
  let prompt: string = ''
  let incomingSlug: string | null = null
  let incomingStyleRaw: string | null = null
  try {
    console.log('[parse-prompt] LLM enabled (Gemini):', Boolean(process.env.GEMINI_API_KEY))
    const body = await req.json()
    prompt = (body?.prompt || '').toString()
    console.debug('[parse-prompt] body parsed', { promptLen: prompt.length, hasPrompt: Boolean(prompt.trim()) })
    // Optional known context coming from UI
    incomingSlug = body?.productSlug ? String(body.productSlug) : null
    incomingStyleRaw = body?.style ? String(body.style) : null
    const knownProduct = incomingSlug ? PRODUCTS.find((p) => p.slug === incomingSlug) : undefined
    const knownStyle = incomingStyleRaw
      ? STYLES.find((s) => s.toLowerCase() === incomingStyleRaw.toLowerCase())
      : undefined
    if (!prompt.trim()) {
      console.warn('[parse-prompt] empty prompt, returning early')
      return NextResponse.json({ productSlug: null, productName: null, expandedPrompt: '' })
    }

    // If no API key, use heuristic fallback
    if (!process.env.GEMINI_API_KEY) {
      const hit = detectProduct(prompt)
      console.warn('[parse-prompt] no GEMINI_API_KEY, heuristic fallback', { hit })
      return NextResponse.json({ productSlug: hit?.slug ?? null, productName: hit?.name ?? null, expandedPrompt: prompt.trim() })
    }

    const productChoices = PRODUCTS.map((p) => `${p.slug} | ${p.name}`).join('\n')
    const styleChoices = STYLES.join(', ')
    const contextNotes = [
      knownProduct ? `Known product: ${knownProduct.slug} | ${knownProduct.name}` : null,
      knownStyle ? `Known style: ${knownStyle}` : null,
    ].filter(Boolean).join('\n')
    const systemPrompt = `
You are an assistant for a print-on-demand design app. Parse a user's free-form prompt and return structured data.

Tasks:
1) Identify the most likely product from this CLOSED SET (choose ONLY one or none):\n${productChoices}\nReturn its slug and name. If uncertain or none, return null for both.
2) Suggest a style from this CLOSED SET (choose ONLY one or none): ${styleChoices}. If the user clearly implies a style, choose it; otherwise return null. If a style is provided as KNOWN CONTEXT, you MUST return that style verbatim as suggestedStyle.
3) Expand and refine the prompt into a single high-quality image-generation prompt. Keep it concise and visual, avoid brand names and copyrighted characters. If the chosen or implied style is "Anime", prefer keyword-rich tokens suitable for anime-focused models. Otherwise, prefer clear natural language. Keep it compatible with various products.
4) Optionally include a negativePrompt (may be empty) with generic safe negatives, and if style is "Anime", include typical anime negatives (e.g., lowres, bad anatomy, extra fingers, watermark).

KNOWN CONTEXT (may be empty):
${contextNotes || '(none)'}

Output must match the provided JSON schema exactly.`.trim()

    const schema = z.object({
      productSlug: z.string().nullable().describe('One of the allowed slugs or null if not specified'),
      productName: z.string().nullable().describe('Human-readable product name or null if not specified'),
      suggestedStyle: z.string().nullable().describe('One of the allowed styles or null if not specified'),
      expandedPrompt: z.string().min(1).describe('Refined single-line prompt suitable for an image generator'),
      negativePrompt: z.string().nullable().describe('Optional negative prompt keywords; may be empty'),
    })

    const openai = new OpenAI({
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    })

    const responseFormat = zodResponseFormat(schema, 'ParsePrompt')
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    console.debug('[parse-prompt] invoking Gemini via OpenAI SDK', { model })
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      response_format: responseFormat,
      temperature: 0.2,
    })

    const content = completion.choices?.[0]?.message?.content
    if (!content) {
      console.error('[parse-prompt] no content from Gemini', completion)
      throw new Error('No content from Gemini')
    }
    let json: unknown
    try {
      json = JSON.parse(content)
    } catch (e) {
      console.error('[parse-prompt] failed to JSON.parse model content', { content })
      throw new Error('Model did not return valid JSON')
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      console.error('[parse-prompt] schema validation failed', parsed.error.flatten())
      throw new Error('Response schema validation failed')
    }
    const result = parsed.data
    console.debug('[parse-prompt] LLM result summary', {
      productSlug: result.productSlug,
      productName: result.productName,
      suggestedStyle: result.suggestedStyle,
      expandedPromptLen: result?.expandedPrompt?.length || 0,
      hasNegative: Boolean(result?.negativePrompt),
    })

    // Validate result against available products if model hallucinated a slug
    let outSlug = result.productSlug
    let outName = result.productName
    let outStyle = (knownStyle || result.suggestedStyle) as string | null | undefined
    if (outSlug) {
      const prod = PRODUCTS.find((p) => p.slug === outSlug)
      if (!prod) {
        // try to map by name case-insensitively
        const byName = PRODUCTS.find((p) => p.name.toLowerCase() === (outName || '').toLowerCase())
        if (byName) {
          outSlug = byName.slug
          outName = byName.name
        } else {
          outSlug = null
          outName = null
        }
      } else {
        outName = prod.name
      }
    }

    // Validate suggested style
    if (outStyle) {
      const match = STYLES.find((s) => s.toLowerCase() === outStyle!.toLowerCase())
      outStyle = match || null
    } else {
      outStyle = null
    }

    const negativePrompt = (result as any).negativePrompt || ''

    const response = {
      productSlug: outSlug,
      productName: outName,
      suggestedStyle: outStyle,
      expandedPrompt: result.expandedPrompt,
      negativePrompt,
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[parse-prompt]', {
        inputPrompt: prompt,
        knownProduct: knownProduct ? knownProduct.slug : null,
        knownStyle: knownStyle || null,
        ...response,
      })
    }

    return NextResponse.json(response)
  } catch (e) {
    console.error('[parse-prompt] error in handler', e)
    // Graceful fallback
    try {
      const hit = detectProduct((prompt || '').toString())
      const styleMatch = incomingStyleRaw ? STYLES.find((s) => s.toLowerCase() === String(incomingStyleRaw).toLowerCase()) : null
      const productMatch = incomingSlug ? PRODUCTS.find((p) => p.slug === String(incomingSlug)) : null
      return NextResponse.json({
        productSlug: productMatch?.slug ?? hit?.slug ?? null,
        productName: productMatch?.name ?? hit?.name ?? null,
        suggestedStyle: styleMatch ?? null,
        expandedPrompt: (prompt || '').toString().trim(),
        negativePrompt: '',
      })
    } catch (inner) {
      console.error('[parse-prompt] fallback error parsing req body', inner)
      return NextResponse.json({ productSlug: null, productName: null, suggestedStyle: null, expandedPrompt: '', negativePrompt: '' })
    }
  }
}
