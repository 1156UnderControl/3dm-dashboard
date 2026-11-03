import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: {}, db: { fake: true }, rtdb: {} }))
vi.mock('../../data/items', () => ({
  createItem: vi.fn(), updateItem: vi.fn(), acceptItem: vi.fn(), rejectItem: vi.fn(), deleteItem: vi.fn(),
}))
vi.mock('../../data/presence', () => ({ setPresence: vi.fn(() => Promise.resolve()) }))
const skills: unknown[] = []
vi.mock('../../data/hooks', () => ({
  useItems: () => ({ data: skills, loading: false, error: null }),
}))

import { createItem, updateItem } from '../../data/items'
import { getStep } from '../../threedm/template'
import type { Item } from '../../threedm/types'
import PriorityBoard from './PriorityBoard'

const stepDef = getStep('2')
const kindDef = stepDef.kinds[0]
const mk = (over: Partial<Item>): Item => ({
  id: 'p1', stepId: '2', kind: 'priority', data: { item: 'Coletar FUEL', bucket: 'Precisamos' }, origin: 'human',
  state: 'active', order: 1, createdBy: 'a@x', updatedBy: 'a@x', updatedAt: 1, ...over,
})
const sk = (id: string, habilidade: string): Item => ({
  id, stepId: '1.4', kind: 'skill', data: { habilidade }, origin: 'human', state: 'active', order: 1,
  createdBy: 'a', updatedBy: 'a', updatedAt: 1,
})
const renderBoard = (items: Item[]) =>
  render(<PriorityBoard sid="s1" stepDef={stepDef} kindDef={kindDef} items={items} readOnly={false} by="me@x" presence={{}} />)

beforeEach(() => { vi.clearAllMocks(); skills.length = 0 })

describe('PriorityBoard', () => {
  it('moving a card calls updateItem with the new bucket', async () => {
    const item = mk({})
    renderBoard([item])
    await userEvent.selectOptions(screen.getByLabelText('Mover para…'), 'Ignorar')
    await userEvent.type(screen.getByLabelText('Motivo (opcional)'), 'fora de escopo')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(updateItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x', item, { bucket: 'Ignorar' }, 'fora de escopo')
  })

  it('places cards in columns, unclassified in Sem classificação', () => {
    renderBoard([mk({}), mk({ id: 'p2', data: { item: 'X', bucket: '' } })])
    expect(within(screen.getByTestId('col-Precisamos')).getByText('Coletar FUEL')).toBeInTheDocument()
    expect(within(screen.getByTestId('col-sem')).getByText('X')).toBeInTheDocument()
  })

  it('import skills does not duplicate existing items', async () => {
    skills.push(sk('s1', 'Coletar fuel'), sk('s2', 'Escalar'))
    renderBoard([mk({ data: { item: '  coletar FUEL ', bucket: '' } })])
    await userEvent.click(screen.getByRole('button', { name: 'Importar habilidades da 1.4' }))
    expect(createItem).toHaveBeenCalledTimes(1)
    expect(createItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x',
      { stepId: '2', kind: 'priority', data: { item: 'Escalar', bucket: '' } })
  })

  it('AI cards show badge and accept button', () => {
    renderBoard([mk({ origin: 'ai', citation: 'm' })])
    expect(screen.getByText('IA')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument()
  })
})
