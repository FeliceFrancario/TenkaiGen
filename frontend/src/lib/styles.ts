export const STYLES = [
  'Anime',
  'Line Art',
  'Flat Logo',
  'Watercolor',
  'Abstract',
  'Minimalist',
  'Vintage',
  'Grunge',
  'Standard',
] as const

export type StyleName = typeof STYLES[number]
