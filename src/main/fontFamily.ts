// A font family name typed or picked by the streamer, made safe to put inside a CSS `font-family`
// (the overlays build `'Name', <fallback>` from it): letters, digits, space and `_ . + & -` only,
// no quotes / braces / semicolons, at most 60 characters. '' = no custom font.
export function fontFamily(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v
    .replace(/[^\p{L}\p{N} _.+&-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}
