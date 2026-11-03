import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: {}, db: {}, rtdb: {} }))
vi.mock('../../data/hooks', () => ({ useSeason: vi.fn() }))
vi.mock('../../data/config', () => ({ useAppConfig: () => ({ aiProvider: 'anthropic', model: 'm' }) }))
vi.mock('../../ai/keys', () => ({ useTeamKeys: () => ({}), resolveKey: () => null }))

import { useSeason } from '../../data/hooks'
import { getStep } from '../../threedm/template'
import { SuggestBar } from './AiTools'

const step = getStep('1.2')
const renderBar = (season: unknown, readOnly = false) => {
  vi.mocked(useSeason).mockReturnValue({ data: season, loading: false } as never)
  return render(<MemoryRouter><SuggestBar sid="s" stepDef={step} kindDef={step.kinds[0]} items={[]} by="a@x" readOnly={readOnly} /></MemoryRouter>)
}

describe('SuggestBar', () => {
  it('disabled with link when no key', () => {
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
