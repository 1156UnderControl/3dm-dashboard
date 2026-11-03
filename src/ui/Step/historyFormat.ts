const IMG = (v: unknown) => (typeof v === 'string' && v.startsWith('data:') ? '[imagem]' : v)

/** History value for display: '—' when empty; inline image data URLs (at any depth) shown as "[imagem]". */
export const fmt = (v: unknown): string =>
  v === null || v === undefined || v === '' ? '—'
    : typeof v === 'object' ? JSON.stringify(v, (_k, x) => IMG(x)) : String(IMG(v))
