import { describe, expect, test } from 'vitest'
import { fmt } from './historyFormat'

describe('history fmt', () => {
  test('abbreviates data: strings (top-level and nested) to [imagem]', () => {
    expect(fmt('data:image/jpeg;base64,AAAA')).toBe('[imagem]')
    expect(fmt({ foto: 'data:image/png;base64,B' })).toBe('{"foto":"[imagem]"}')
    expect(fmt('texto')).toBe('texto')
    expect(fmt('')).toBe('—')
  })
})
