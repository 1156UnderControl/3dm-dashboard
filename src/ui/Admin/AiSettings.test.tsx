import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Ctx } from '../../auth/context'

const h = vi.hoisted(() => ({ team: {} as Record<string, string>, setTeamKey: vi.fn(async () => {}), generate: vi.fn(async () => ({ ok: true })) }))
vi.mock('../../firebase', () => ({ db: {} }))
vi.mock('../../data/config', async (orig) => ({ ...(await orig<typeof import('../../data/config')>()), useAppConfig: () => ({ aiProvider: 'anthropic', model: 'claude-sonnet-5-5' }), setAppConfig: vi.fn() }))
vi.mock('../../ai/keys', async (orig) => ({ ...(await orig<typeof import('../../ai/keys')>()), useTeamKeys: () => h.team, setTeamKey: h.setTeamKey }))
vi.mock('../../ai/provider', async (orig) => ({ ...(await orig<typeof import('../../ai/provider')>()), getProvider: () => ({ generate: h.generate }) }))

import AiSettings from './AiSettings'

const renderAs = (role: 'admin' | 'member') => render(
  <Ctx.Provider value={{ user: { email: 'a@b.c' } as never, member: { email: 'a@b.c', role }, loading: false }}><AiSettings /></Ctx.Provider>)

beforeEach(() => { localStorage.clear(); h.team = {}; vi.clearAllMocks() })

describe('AiSettings', () => {
  test('saves personal key, never echoes it, shows last 4', () => {
    renderAs('member')
    expect(screen.getByLabelText('Chave pessoal')).toHaveAttribute('type', 'password')
    fireEvent.change(screen.getByLabelText('Chave pessoal'), { target: { value: 'sk-abcd1234' } })
    fireEvent.click(screen.getByText('Salvar'))
    expect(localStorage.getItem('3dm.ai.key.anthropic')).toBe('sk-abcd1234')
    expect(screen.getByTestId('personal-hint')).toHaveTextContent('•••• 1234')
    expect(screen.queryByDisplayValue('sk-abcd1234')).toBeNull()
    expect(screen.getByTestId('active-key')).toHaveTextContent('Usando: chave pessoal')
    expect(screen.queryByText('Chave da equipe (Anthropic)')).toBeNull()
  })
  test('test button reports success and remove clears', async () => {
    localStorage.setItem('3dm.ai.key.anthropic', 'sk-zzzz')
    renderAs('member')
    fireEvent.click(screen.getByText('Testar chave'))
    expect(await screen.findByText('Chave funcionando.')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Remover chave'))
    expect(localStorage.getItem('3dm.ai.key.anthropic')).toBeNull()
  })
  test('admin sees team section and writes via setTeamKey', () => {
    h.team = { anthropic: 'team-9999' }
    renderAs('admin')
    expect(screen.getByTestId('active-key')).toHaveTextContent('Usando: chave da equipe')
    expect(screen.getByTestId('team-hint')).toHaveTextContent('•••• 9999')
    fireEvent.change(screen.getByLabelText('Chave da equipe'), { target: { value: 'new-key' } })
    fireEvent.click(screen.getByText('Salvar chave da equipe'))
    expect(h.setTeamKey).toHaveBeenCalledWith({}, 'a@b.c', 'anthropic', 'new-key')
  })
})
