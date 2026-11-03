import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../firebase', () => ({ auth: {}, db: { fake: true }, rtdb: {} }))
vi.mock('../../data/steps', () => ({ updateStep: vi.fn(), closeStep: vi.fn(), reopenStep: vi.fn() }))

import { reopenStep } from '../../data/steps'
import { getStep } from '../../threedm/template'
import type { StepState } from '../../threedm/types'
import StepHeader from './StepHeader'

const render1 = (state: Partial<StepState>) =>
  render(<StepHeader sid="s1" stepDef={getStep('1.2')} state={{ stepId: '1.2', status: 'em_andamento', conclusion: '', ...state }} groups={[]} by="me@x" readOnly={false} />)

beforeEach(() => vi.clearAllMocks())

describe('StepHeader', () => {
  it('status select has no Concluído option while open', () => {
    render1({})
    expect(screen.queryByRole('option', { name: 'Concluído' })).toBeNull()
  })

  it('status select is disabled when closed', () => {
    render1({ status: 'concluido' })
    expect(screen.getByLabelText('Status')).toBeDisabled()
  })

  it('Reabrir needs a non-empty motivo', async () => {
    render1({ status: 'concluido' })
    await userEvent.click(screen.getByRole('button', { name: 'Reabrir' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reabertura' }))
    await userEvent.type(screen.getByLabelText('Motivo da reabertura'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reabertura' }))
    expect(reopenStep).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Motivo da reabertura'), 'erro')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reabertura' }))
    expect(reopenStep).toHaveBeenCalledWith({ fake: true }, 's1', 'me@x', '1.2', 'erro')
  })
})
