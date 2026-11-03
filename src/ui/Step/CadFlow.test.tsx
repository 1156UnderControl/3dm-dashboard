import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: {}, db: { fake: true }, rtdb: {} }))
vi.mock('../../data/items', () => ({
  createItem: vi.fn(), updateItem: vi.fn(), acceptItem: vi.fn(), rejectItem: vi.fn(), deleteItem: vi.fn(),
}))
vi.mock('../../data/presence', () => ({ setPresence: vi.fn(() => Promise.resolve()) }))

import { getStep } from '../../threedm/template'
import type { Item } from '../../threedm/types'
import CadFlow from './CadFlow'

const stepDef = getStep('5.2')
const mk = (id: string, kind: string, data: Record<string, unknown>, state = 'active'): Item =>
  ({ id, stepId: '5.2', kind, data, origin: 'human', state, order: 1, createdBy: 'a', updatedBy: 'a', updatedAt: 1 }) as Item
const renderIt = (items: Item[]) =>
  render(<CadFlow sid="s1" stepDef={stepDef} items={items} readOnly={false} by="me@x" presence={{}} />)

describe('CadFlow', () => {
  it('shows negative remaining in red', () => {
    renderIt([mk('b', 'budget', { peso_max_kg: 10 }), mk('c1', 'cad', { peso_kg: 6 }), mk('c2', 'cad', { peso_kg: 5.4 }),
      mk('c3', 'cad', { peso_kg: 100 }, 'rejected')])
    const el = screen.getByText('Sobra: -1.4 kg')
    expect(el).toHaveAttribute('data-negative', 'true')
    expect(el.className).toMatch(/red/)
  })
  it('defaults max to 52.16', () => {
    renderIt([mk('c1', 'cad', { peso_kg: 2.16 })])
    const el = screen.getByText('Sobra: 50 kg')
    expect(el).not.toHaveAttribute('data-negative', 'true')
  })
})
