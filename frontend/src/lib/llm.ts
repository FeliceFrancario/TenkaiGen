import OpenAI from 'openai'

export function getOpenAIForGemini() {
  const apiKey = process.env.GEMINI_API_KEY
  const baseURL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[llm] OpenAI client (Gemini) config', { baseURL })
  }
  return new OpenAI({ apiKey, baseURL })
}
