import { describe, expect, test, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: {}, auth: {}, rtdb: {} }))
import { scrubImages } from './items'

describe('scrubImages', () => {
  test('replaces data: strings with [imagem] at any depth, leaves the rest', () => {
    expect(scrubImages('data:image/png;base64,AAA')).toBe('[imagem]')
    expect(scrubImages({ a: 'data:x', b: 'texto', c: 3, d: null, e: [{ f: 'data:y' }, 'https://x/y.png'] }))
      .toEqual({ a: '[imagem]', b: 'texto', c: 3, d: null, e: [{ f: '[imagem]' }, 'https://x/y.png'] })
    expect(scrubImages(undefined)).toBeUndefined()
  })
})
