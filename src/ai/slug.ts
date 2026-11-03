/** Stable lowercase-hyphen slug; non-latin/empty-after-normalization text falls back to a hash. */
export function slug(text: string): string {
  const s = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  if (s) return s
  let h = 5381
  for (const ch of text.trim().toLowerCase()) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0
  return `q${h.toString(36)}`
}
