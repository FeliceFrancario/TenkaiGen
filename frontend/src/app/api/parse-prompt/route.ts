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
    console.log('[parse-prompt] LLM enabled:', Boolean(process.env.LLM_API_KEY || process.env.GEMINI_API_KEY))
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
      return NextResponse.json({
        productSlug: knownProduct?.slug ?? null,
        productName: knownProduct?.name ?? null,
        suggestedStyle: knownStyle ?? null,
        franchise: null,
        expandedPrompt: '',
      })
    }

    // If no API key, use heuristic fallback
    if (!(process.env.LLM_API_KEY || process.env.GEMINI_API_KEY)) {
      const hit = detectProduct(prompt)
      console.warn('[parse-prompt] no GEMINI_API_KEY, heuristic fallback', { hit })
      return NextResponse.json({
        productSlug: knownProduct?.slug ?? hit?.slug ?? null,
        productName: knownProduct?.name ?? hit?.name ?? null,
        suggestedStyle: knownStyle ?? null,
        franchise: null,
        expandedPrompt: prompt.trim(),
      })
    }

    const productChoices = PRODUCTS.map((p) => `${p.slug} | ${p.name}`).join('\n')
    const styleChoices = STYLES.join(', ')
    const contextNotes = [
      knownProduct ? `Known product: ${knownProduct.slug} | ${knownProduct.name}` : null,
      knownStyle ? `Known style: ${knownStyle}` : null,
    ].filter(Boolean).join('\n')
    const systemPrompt = `
You are a Prompt Optimizer and Workflow Router for a print-on-demand design app.
Your job is to take a user's free-form prompt and return structured JSON that both expands the prompt into a high-quality image-generation prompt AND indicates workflow choices (product, style, franchise).

Tasks:
1. Identify the most likely product from this CLOSED SET:\n${productChoices}\nReturn its slug and name. If uncertain or none, return null for both.

2. Identify if the input mentions or implies a specific franchise (anime, games, comics, etc). Examples: "One Piece", "Naruto", "Marvel".
- If a franchise is detected, output its name in the ` + "`franchise`" + ` field.
- If none, return null.
This will be used to decide LoRA attachments (e.g., franchise: "One Piece" → apply One Piece LoRA).

3. Suggest a style from this CLOSED SET:\n${styleChoices}\nIf the user clearly implies a style, choose it; otherwise return null.
If style is provided in KNOWN CONTEXT, you MUST return it exactly.

4. Expand and refine the user’s prompt into a polished image-generation prompt:
- IMPORTANT: Never mention the product (t-shirt, hoodie, mug, etc.) in the expanded prompt.
- If style = "Anime": format as danbooru-style tags (comma-separated, descriptive, detailed).
- If style = anything else: format as natural language expansion (similar to Qwen examples).
- Keep it under 200 words.
- Do not include a negative prompt (workflow will handle that).

5. Output MUST match the JSON schema below, no extra text.

KNOWN CONTEXT (may be empty):
${contextNotes || '(none)'}

JSON Schema:
{
  "productSlug": string | null,
  "productName": string | null,
  "suggestedStyle": string | null,
  "franchise": string | null,
  "expandedPrompt": string
}`.trim()

    const schema = z.object({
      productSlug: z.string().nullable().describe('One of the allowed slugs or null if not specified'),
      productName: z.string().nullable().describe('Human-readable product name or null if not specified'),
      suggestedStyle: z.string().nullable().describe('One of the allowed styles or null if not specified'),
      franchise: z.string().nullable().describe('Franchise name if detected; otherwise null'),
      expandedPrompt: z.string().min(1).describe('Refined detailed prompt suitable for an image generator'),
    })

    const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY as string
    const baseURL = process.env.LLM_BASE_URL || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'
    const openai = new OpenAI({ apiKey, baseURL })

    const responseFormat = zodResponseFormat(schema, 'ParsePrompt')
    const model = process.env.LLM_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const provider = baseURL.includes('googleapis')
      ? 'Google'
      : baseURL.includes('groq.com')
      ? 'Groq'
      : baseURL.includes('openrouter.ai')
      ? 'OpenRouter'
      : 'Unknown'
    console.debug('[parse-prompt] invoking via OpenAI SDK', { provider, model })

    let completion:
      | Awaited<ReturnType<typeof openai.chat.completions.create>>
      | null = null

    // Prefer json_schema for Google/Gemini; json_object for Groq/OpenRouter.
    const preferSchema = provider === 'Google' || /^gemini-/i.test(model)
    const tryJsonObjectFirst = provider === 'Groq' || provider === 'OpenRouter'

    const runRequest = async (format: 'schema' | 'object' | 'none') => {
      const rf: any =
        format === 'schema'
          ? responseFormat
          : format === 'object'
          ? { type: 'json_object' }
          : undefined
      return openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        ...(rf ? { response_format: rf } : {}),
        temperature: 0.2,
      } as any)
    }

    try {
      if (tryJsonObjectFirst) {
        // e.g., Groq/OpenRouter
        completion = await runRequest('object')
      } else if (preferSchema) {
        completion = await runRequest('schema')
      } else {
        completion = await runRequest('object')
      }
    } catch (err: any) {
      const msg = String(err?.message || err)
      console.warn('[parse-prompt] first attempt failed, retrying with fallback', { provider, msg })
      try {
        if (preferSchema) {
          // If schema failed (e.g., Groq 400), retry with json_object
          completion = await runRequest('object')
        } else {
          // Retry with no response_format and rely on strict prompting
          completion = await runRequest('none')
        }
      } catch (err2) {
        console.error('[parse-prompt] second attempt failed', { provider, err2 })
        throw err2
      }
    }

    const content = completion.choices?.[0]?.message?.content
    if (!content) {
      console.error('[parse-prompt] no content from LLM', completion)
      throw new Error('No content from LLM')
    }
    let json: unknown
    try {
      json = JSON.parse(content)
    } catch (e) {
      console.warn('[parse-prompt] strict JSON.parse failed, trying extraction fallback')
      // Try fenced code block first
      const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
      if (fence && fence[1]) {
        try {
          json = JSON.parse(fence[1].trim())
        } catch {}
      }
      // Try first balanced braces slice as last resort
      if (!json) {
        const first = content.indexOf('{')
        const last = content.lastIndexOf('}')
        if (first !== -1 && last !== -1 && last > first) {
          const slice = content.slice(first, last + 1)
          try {
            json = JSON.parse(slice)
          } catch {}
        }
      }
      if (!json) {
        console.error('[parse-prompt] failed to extract JSON from content', { content })
        throw new Error('Model did not return valid JSON')
      }
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
      franchise: (result as any).franchise ?? null,
      expandedPromptLen: result?.expandedPrompt?.length || 0,
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

    const response = {
      productSlug: outSlug,
      productName: outName,
      suggestedStyle: outStyle,
      franchise: (result as any).franchise ?? null,
      expandedPrompt: result.expandedPrompt,
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
        franchise: null,
        expandedPrompt: (prompt || '').toString().trim(),
      })
    } catch (inner) {
      console.error('[parse-prompt] fallback error parsing req body', inner)
      return NextResponse.json({ productSlug: null, productName: null, suggestedStyle: null, franchise: null, expandedPrompt: '' })
    }
  }
}
