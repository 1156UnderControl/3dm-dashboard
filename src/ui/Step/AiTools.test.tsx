import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: {}, db: {}, rtdb: {} }))
vi.mock('../../data/hooks', () => ({ useSeason: vi.fn() }))
vi.mock('../../data/config', () => ({ useAppConfig: () => ({ aiProvider: 'anthropic', model: 'm' }) }))
vi.mock('../../ai/keys', () => ({ useTeamKeys: () => ({}), resolveKey: () => (globalThis as { __noKey?: boolean }).__noKey ? null : ({ key: 'k', source: 'pessoal' }) }))
vi.mock('../../data/items', () => ({ createItem: vi.fn(), createItems: vi.fn() }))
vi.mock('../../ai/pdfCache', () => ({ pdfCache: { get: async () => null } }))
vi.mock('../../ai/provider', async (o) => ({ ...(await o<object>()), getProvider: () => ({}) }))
vi.mock('../../ai/suggest', async (o) => ({ ...(await o<object>()), askManual: async () => ({ answer: 'r', citacao: 'c' }) }))

import { useSeason } from '../../data/hooks'
import { getStep } from '../../threedm/template'
import userEvent from '@testing-library/user-event'
import { createItem } from '../../data/items'
import { AskManual, SuggestBar } from './AiTools'

const step = getStep('1.2')
const renderBar = (season: unknown, readOnly = false) => {
  vi.mocked(useSeason).mockReturnValue({ data: season, loading: false } as never)
  return render(<MemoryRouter><SuggestBar sid="s" stepDef={step} kindDef={step.kinds[0]} items={[]} by="a@x" readOnly={readOnly} /></MemoryRouter>)
}

describe('AskManual save', () => {
  it('does not create a duplicate aiKey', async () => {
    vi.mocked(useSeason).mockReturnValue({ data: { status: 'active', model: {} }, loading: false } as never)
    const items = [{ id: 'i', aiKey: 'question:posso' }] as never
    render(<MemoryRouter><AskManual sid="s" by="a@x" readOnly={false} items={items} /></MemoryRouter>)
    await userEvent.type(screen.getByLabelText('Pergunta ao manual'), 'Posso')
    await userEvent.click(screen.getByRole('button', { name: 'Perguntar' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar como pergunta' }))
    expect(createItem).not.toHaveBeenCalled()
    expect(screen.getByText('Essa pergunta já foi salva')).toBeInTheDocument()
  })
})

describe('SuggestBar', () => {
  it('disabled with link when no key', () => {
    ;(globalThis as { __noKey?: boolean }).__noKey = true
    renderBar({ status: 'active', model: {} })
    expect(screen.getByRole('button', { name: /Sugerir mais/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'configure uma chave' })).toHaveAttribute('href', '/settings/ai')
  })
  it('hint when model missing', () => {
    renderBar({ status: 'active' })
    expect(screen.getByText('Rode a configuração da temporada primeiro')).toBeInTheDocument()
  })
  it('hidden when archived', () => {
    const { container } = renderBar({ status: 'archived', model: {} })
    expect(container).toBeEmptyDOMElement()
  })
})
