import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: {}, db: { fake: true }, rtdb: {} }))
vi.mock('../../data/items', () => ({
  createItem: vi.fn(() => Promise.resolve('new1')), updateItem: vi.fn(), acceptItem: vi.fn(), rejectItem: vi.fn(), deleteItem: vi.fn(),
}))
vi.mock('../../data/presence', () => ({ setPresence: vi.fn(() => Promise.resolve()) }))
const mkI = (id: string, stepId: string, kind: string, data: Record<string, unknown>) => ({
  id, stepId, kind, data, origin: 'human', state: 'active', order: 1, createdBy: 'a', updatedBy: 'a', updatedAt: 1,
})
const byStep: Record<string, unknown[]> = {
  '2': [mkI('p1', '2', 'priority', { item: 'Coletar FUEL', bucket: 'Precisamos' }),
    mkI('p2', '2', 'priority', { item: 'Escalar', bucket: 'Queremos' }),
    mkI('p3', '2', 'priority', { item: 'Ignorado', bucket: 'Ignorar' })],
  '4.1': [mkI('a1', '4.1', 'archetype', { nome: 'Arq A' })],
}
vi.mock('../../data/hooks', () => ({
  useItems: (_s: string, step: string) => ({ data: byStep[step] ?? [], loading: false, error: null }),
}))
const scoreMock = vi.fn()
vi.mock('../../threedm/matrix', () => ({ scoreMatrix: (i: unknown) => scoreMock(i) }))

import { createItem, updateItem } from '../../data/items'
import { getStep } from '../../threedm/template'
import type { Item } from '../../threedm/types'
import DecisionMatrix from './DecisionMatrix'

const stepDef = getStep('4.2')
const own = (extra: Item[] = []) => [
  mkI('at1', '4.2', 'attribute', { atributo: 'Simplicity', peso: 0.2 }), ...extra,
] as Item[]
const renderIt = (items: Item[]) =>
  render(<DecisionMatrix sid="s1" stepDef={stepDef} items={items} readOnly={false} by="me@x" presence={{}} />)

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createItem).mockImplementation(() => Promise.resolve('new1'))
  scoreMock.mockReturnValue({ a1: { coveragePct: 0.5, weighted: 0.8, finalPct: 83, missingNeeds: [] } })
})

describe('DecisionMatrix', () => {
  it('shows final percent from scoreMatrix', () => {
    renderIt(own())
    expect(screen.getByTestId('final-a1')).toHaveTextContent('83%')
    expect(screen.getByTestId('coverage-a1')).toHaveTextContent('50%')
    expect(screen.getByTestId('weighted-a1')).toHaveTextContent('80%')
    expect(screen.queryByText(/Precisamos não atendidas/)).toBeNull()
  })

  it('warns about uncovered Precisamos', () => {
    scoreMock.mockReturnValue({ a1: { coveragePct: 0, weighted: 0, finalPct: 0, missingNeeds: ['p1'] } })
    renderIt(own())
    expect(screen.getByText(/Precisamos não atendidas/)).toHaveTextContent('Coletar FUEL')
  })

  it('toggling coverage creates an item, then updates', async () => {
    renderIt(own())
    await userEvent.click(screen.getByLabelText('Coletar FUEL / Arq A'))
    expect(createItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x',
      { stepId: '4.2', kind: 'coverage', data: { archetypeId: 'a1', priorityId: 'p1', atende: true } })
  })

  it('toggling existing coverage updates it', async () => {
    const cov = mkI('c1', '4.2', 'coverage', { archetypeId: 'a1', priorityId: 'p1', atende: true }) as Item
    renderIt(own([cov]))
    await userEvent.click(screen.getByLabelText('Coletar FUEL / Arq A'))
    expect(updateItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x', cov, { atende: false })
  })

  it('clamps score to 0-5', async () => {
    renderIt(own())
    const input = screen.getByLabelText('Simplicity / Arq A')
    await userEvent.type(input, '9')
    await userEvent.tab()
    expect(createItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x',
      { stepId: '4.2', kind: 'score', data: { archetypeId: 'a1', attribute: 'Simplicity', nota: 5 } })
  })

  it('Escolher requires justificativa', async () => {
    renderIt(own())
    await userEvent.selectOptions(screen.getByLabelText('Arquétipo escolhido'), 'a1')
    expect(screen.getByRole('button', { name: 'Escolher' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Justificativa'), 'melhor')
    await userEvent.click(screen.getByRole('button', { name: 'Escolher' }))
    expect(createItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x',
      { stepId: '4.2', kind: 'choice', data: { archetypeId: 'a1', justificativa: 'melhor' } })
  })

  it('rapid coverage toggles on an empty cell create once then update', async () => {
    renderIt(own())
    const box = screen.getByLabelText('Coletar FUEL / Arq A')
    await userEvent.click(box)
    await userEvent.click(box)
    await vi.waitFor(() => expect(updateItem).toHaveBeenCalledTimes(1))
    expect(createItem).toHaveBeenCalledTimes(1)
    expect(vi.mocked(updateItem).mock.calls[0][3]).toMatchObject({ id: 'new1' })
  })

  it('double-click Escolher creates one choice', async () => {
    renderIt(own())
    await userEvent.selectOptions(screen.getByLabelText('Arquétipo escolhido'), 'a1')
    await userEvent.type(screen.getByLabelText('Justificativa'), 'melhor')
    const btn = screen.getByRole('button', { name: 'Escolher' })
    await userEvent.dblClick(btn)
    expect(createItem).toHaveBeenCalledTimes(1)
  })

  it('double-click Usar atributos padrão seeds 4 attributes once', async () => {
    vi.mocked(createItem).mockImplementation(() => new Promise((r) => setTimeout(() => r('x'), 30)))
    renderIt([])
    await userEvent.dblClick(screen.getByRole('button', { name: 'Usar atributos padrão' }))
    await vi.waitFor(() => expect(createItem).toHaveBeenCalledTimes(4))
    expect(createItem).toHaveBeenCalledTimes(4)
  })
})
