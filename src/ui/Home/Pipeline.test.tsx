import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { STAGES, STEPS } from '../../threedm/template'
import type { StepState } from '../../threedm/types'
import { Pipeline } from './Pipeline'

const stepStates: StepState[] = [
  { stepId: '1.1', status: 'em_andamento', conclusion: '', deadline: '2026-10-01', groupId: 'g1' },
  { stepId: '1.2', status: 'concluido', conclusion: 'ok', deadline: '2026-10-01' },
  { stepId: '2', status: 'em_revisao', conclusion: '', deadline: '2026-12-01' },
]

const renderPipeline = (extra: Partial<React.ComponentProps<typeof Pipeline>> = {}) => render(
  <MemoryRouter>
    <Pipeline
      sid="s1" stages={STAGES} steps={STEPS} stepStates={stepStates}
      groups={[{ id: 'g1', name: 'Mecânica', memberEmails: [] }]}
      aiPendingByStep={{ '1.2': 3 }}
      presence={{ u1: { name: 'Ana Souza', stepId: '1.1', at: 1 }, u2: { name: 'Beto', at: 2 } }}
      today="2026-11-03" {...extra}
    />
  </MemoryRouter>,
)

describe('Pipeline', () => {
  it('renders 5 columns with 7/1/1/2/3 steps', () => {
    renderPipeline()
    const cols = screen.getAllByTestId('stage-column')
    expect(cols).toHaveLength(5)
    expect(cols.map((c) => within(c).getAllByTestId('step-card').length)).toEqual([7, 1, 1, 2, 3])
  })

  it('shows AI pending count', () => {
    renderPipeline()
    expect(screen.getByText('3 itens IA para revisar')).toBeInTheDocument()
  })

  it('marks overdue non-closed steps only', () => {
    renderPipeline()
    const cards = screen.getAllByTestId('step-card')
    const byStep = (id: string) => cards.find((c) => c.getAttribute('data-step') === id)!
    expect(byStep('1.1')).toHaveAttribute('data-overdue')
    expect(byStep('1.2')).not.toHaveAttribute('data-overdue')
    expect(byStep('2')).not.toHaveAttribute('data-overdue')
  })

  it('shows Concluído for closed step and online count', () => {
    renderPipeline()
    const card = screen.getAllByTestId('step-card').find((c) => c.getAttribute('data-step') === '1.2')!
    expect(within(card).getByText('Concluído')).toBeInTheDocument()
    expect(screen.getByText('2 online')).toBeInTheDocument()
    expect(screen.getByText('Mecânica')).toBeInTheDocument()
  })
})
