import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: {}, db: { fake: true }, rtdb: {} }))
vi.mock('../../data/items', () => ({
  createItem: vi.fn(), updateItem: vi.fn(), acceptItem: vi.fn(), rejectItem: vi.fn(), deleteItem: vi.fn(),
}))
vi.mock('../../data/presence', () => ({ setPresence: vi.fn(() => Promise.resolve()) }))

import { acceptItem, updateItem } from '../../data/items'
import { setPresence } from '../../data/presence'
import { getStep } from '../../threedm/template'
import type { Item } from '../../threedm/types'
import { ItemTable } from './ItemTable'

const stepDef = getStep('1.2')
const kindDef = stepDef.kinds[0]

const mk = (over: Partial<Item>): Item => ({
  id: 'i1', stepId: '1.2', kind: 'rule', data: { regra: 'G403' }, origin: 'human', state: 'active',
  order: 1, createdBy: 'a@x', updatedBy: 'a@x', updatedAt: 1, ...over,
})

const renderTable = (items: Item[], extra: Partial<React.ComponentProps<typeof ItemTable>> = {}) =>
  render(<ItemTable sid="s1" stepDef={stepDef} kindDef={kindDef} items={items} readOnly={false} by="me@x" presence={{}} {...extra} />)

beforeEach(() => vi.clearAllMocks())

describe('ItemTable', () => {
  it('AI item shows IA badge and accept/reject buttons; human item does not', () => {
    renderTable([
      mk({ id: 'h', origin: 'human' }),
      mk({ id: 'a', origin: 'ai', citation: 'Manual §6' }),
    ])
    const rows = screen.getAllByTestId('item-row')
    const human = rows.find((r) => r.getAttribute('data-item') === 'h')!
    const ai = rows.find((r) => r.getAttribute('data-item') === 'a')!
    expect(within(human).queryByText('IA')).toBeNull()
    expect(within(human).queryByRole('button', { name: 'Aceitar' })).toBeNull()
    expect(within(ai).getByText('IA')).toHaveAttribute('title', 'Manual §6')
    expect(within(ai).getByRole('button', { name: 'Aceitar' })).toBeInTheDocument()
    expect(within(ai).getByRole('button', { name: 'Rejeitar' })).toBeInTheDocument()
  })

  it('clicking accept calls acceptItem', async () => {
    const item = mk({ origin: 'ai' })
    renderTable([item])
    await userEvent.click(screen.getByRole('button', { name: 'Aceitar' }))
    expect(acceptItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x', item)
  })

  it('editing a cell and blurring calls updateItem once with the patch', async () => {
    const item = mk({})
    renderTable([item])
    const input = screen.getByLabelText('Penalidade')
    await userEvent.click(input)
    expect(setPresence).toHaveBeenCalledWith('s1', { stepId: '1.2', field: 'i1.penalidade' })
    await userEvent.type(input, '2 pts')
    expect(updateItem).not.toHaveBeenCalled()
    await userEvent.tab()
    expect(updateItem).toHaveBeenCalledTimes(1)
    expect(updateItem).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x', item, { penalidade: '2 pts' })
  })

  it('does not save when value is unchanged', async () => {
    renderTable([mk({})])
    await userEvent.click(screen.getByLabelText('Regra'))
    await userEvent.tab()
    expect(updateItem).not.toHaveBeenCalled()
  })

  it('shows who else is editing a cell', () => {
    renderTable([mk({})], {
      selfUid: 'me', presence: { other: { name: 'Fulano', field: 'i1.regra', at: 1 }, me: { name: 'Eu', field: 'i1.regra', at: 1 } },
    })
    expect(screen.getByText('Fulano está editando')).toBeInTheDocument()
    expect(screen.queryByText('Eu está editando')).toBeNull()
  })

  it('rejected items are hidden until "Mostrar rejeitados" is clicked', async () => {
    renderTable([mk({ id: 'ok' }), mk({ id: 'rej', state: 'rejected', origin: 'ai' })])
    expect(screen.getAllByTestId('item-row')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar rejeitados (1)' }))
    expect(screen.getAllByTestId('item-row')).toHaveLength(2)
  })

  it('archived season renders inputs disabled', () => {
    renderTable([mk({ origin: 'ai' })], { readOnly: true })
    expect(screen.getByLabelText('Regra')).toBeDisabled()
    expect(screen.getByLabelText('Categoria')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Aceitar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Adicionar linha' })).toBeNull()
  })

  it('enum cell keeps a stored value that is not among the options', () => {
    renderTable([mk({ data: { regra: 'G1', categoria: 'Campo' } })])
    const sel = screen.getByLabelText('Categoria') as HTMLSelectElement
    expect(sel.value).toBe('Campo')
    expect(within(sel).getByRole('option', { name: 'Campo' })).toBeInTheDocument()
  })

  it('link cells only render an href for http(s) URLs', () => {
    const s15 = getStep('1.5')
    const k = s15.kinds.find((x) => x.columns.some((c) => c.type === 'link'))!
    const row = (id: string, link: string): Item => ({ ...mk({ id, stepId: '1.5', kind: k.kind }), data: { link } })
    render(<ItemTable sid="s1" stepDef={s15} kindDef={k} items={[row('a', 'https://ex.com/x'), row('b', 'javascript:alert(1)'), row('c', 'HTTP://ex.com')]}
      readOnly={false} by="me@x" presence={{}} />)
    const links = screen.getAllByRole('link', { name: 'Abrir Link' })
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['https://ex.com/x', 'HTTP://ex.com'])
  })
})
