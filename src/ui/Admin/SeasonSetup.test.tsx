import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Ctx } from '../../auth/context'
import { AiError } from '../../ai/provider'
import { emptyExtraction } from '../../ai/seasonSchema'

const h = vi.hoisted(() => ({
  season: { id: 's26', name: 'REBUILT', year: 2026, status: 'active', createdAt: 1 } as Record<string, unknown>,
  extract: vi.fn(), createItems: vi.fn(async (_d: unknown, _s: string, _b: string, items: unknown[]) => items.length),
  updateDoc: vi.fn(async () => {}), getDocs: vi.fn(async () => ({ docs: [] as unknown[] })),
  put: vi.fn(async () => {}), get: vi.fn(async () => null),
}))
vi.mock('../../firebase', () => ({ db: {} }))
vi.mock('../../data/hooks', () => ({ useSeason: () => ({ data: h.season, loading: false, error: null }) }))
vi.mock('../../data/config', async (orig) => ({ ...(await orig<typeof import('../../data/config')>()), useAppConfig: () => ({ aiProvider: 'anthropic', model: 'm' }) }))
vi.mock('../../ai/keys', async (orig) => ({ ...(await orig<typeof import('../../ai/keys')>()), useTeamKeys: () => ({ anthropic: 'k' }) }))
vi.mock('../../ai/extract', () => ({ extractSeason: (...a: unknown[]) => h.extract(...a) }))
vi.mock('../../ai/pdfCache', () => ({ pdfCache: { put: h.put, get: h.get } }))
vi.mock('../../data/items', () => ({ createItems: h.createItems }))
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  getDocs: h.getDocs, updateDoc: h.updateDoc,
  collection: () => ({}), doc: () => ({}),
}))

import SeasonSetup from './SeasonSetup'

const renderPage = () => render(
  <Ctx.Provider value={{ user: { email: 'a@b.c' } as never, member: { email: 'a@b.c', role: 'admin' }, loading: false }}>
    <MemoryRouter initialEntries={['/s/s26/setup']}>
      <Routes><Route path="/s/:sid/setup" element={<SeasonSetup />} /></Routes>
    </MemoryRouter>
  </Ctx.Provider>)

const pick = () => {
  const file = new File([new Uint8Array([37, 80, 68, 70])], 'manual.pdf', { type: 'application/pdf' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array([37, 80, 68, 70]).buffer })
  fireEvent.change(screen.getByLabelText('Manual do jogo (PDF)'), { target: { files: [file] } })
}

beforeEach(() => { vi.clearAllMocks(); h.season.status = 'active'; h.getDocs.mockImplementation(async () => ({ docs: [] })) })

describe('SeasonSetup', () => {
  test('extracts, previews counts per step and writes items + season model', async () => {
    h.extract.mockImplementation(async (_p: unknown, _b: unknown, onProgress: (d: number, t: number) => void) => {
      onProgress(0, 7)
      return { ...emptyExtraction(), gameName: 'REBUILT', rules: [{ key: 'G403', texto: 't', porque: 'p', penalidade: 'x', categoria: 'Gameplay' }] }
    })
    renderPage()
    pick()
    fireEvent.click(await screen.findByText('Ler manual com IA'))
    expect(await screen.findByTestId('count-1.2')).toHaveTextContent('1')
    expect(h.put).toHaveBeenCalledWith('s26', expect.any(Uint8Array))
    fireEvent.click(screen.getByText('Adicionar ao 3DM'))
    expect(await screen.findByText('1 itens adicionados ao 3DM.')).toBeInTheDocument()
    expect(h.createItems).toHaveBeenCalledWith({}, 's26', 'a@b.c', [expect.objectContaining({ aiKey: 'rule:G403', origin: 'ai' })])
    expect(h.updateDoc).toHaveBeenCalledWith({}, { model: expect.objectContaining({ gameName: 'REBUILT' }) })
  })

  test('retry after a partial save failure re-dedupes and writes only missing items', async () => {
    const r = (key: string) => ({ key, texto: 't', porque: 'p', penalidade: 'x', categoria: 'Gameplay' })
    h.extract.mockResolvedValue({ ...emptyExtraction(), gameName: 'REBUILT', rules: [r('G403'), r('G407'), r('R103')] })
    const existing: { id: string; data: () => Record<string, unknown> }[] = []
    h.getDocs.mockImplementation(async () => ({ docs: [...existing] }))
    h.createItems.mockImplementationOnce(async () => {
      existing.push({ id: 'a', data: () => ({ aiKey: 'rule:G403' }) }) // first batch committed, then failure
      throw new Error('network')
    })
    renderPage()
    pick()
    fireEvent.click(await screen.findByText('Ler manual com IA'))
    fireEvent.click(await screen.findByText('Adicionar ao 3DM'))
    expect(await screen.findByText(/Falha ao salvar/)).toBeInTheDocument()
    expect(h.updateDoc).toHaveBeenCalledTimes(1) // model written first
    existing.push({ id: 'b', data: () => ({ aiKey: 'rule:G407' }) }) // another admin wrote meanwhile
    fireEvent.click(screen.getByText('Adicionar ao 3DM'))
    expect(await screen.findByText('1 itens adicionados ao 3DM.')).toBeInTheDocument()
    expect(h.createItems).toHaveBeenCalledTimes(2)
    expect((h.createItems.mock.calls[1][3] as { aiKey: string }[]).map((i) => i.aiKey)).toEqual(['rule:R103'])
  })

  test('AiError shows message and writes nothing', async () => {
    h.extract.mockRejectedValue(new AiError('rate-limit'))
    renderPage()
    pick()
    fireEvent.click(await screen.findByText('Ler manual com IA'))
    expect(await screen.findByText('Limite de requisições atingido. Tente novamente em instantes.')).toBeInTheDocument()
    expect(screen.queryByText('Adicionar ao 3DM')).toBeNull()
    expect(h.createItems).not.toHaveBeenCalled()
    expect(h.updateDoc).not.toHaveBeenCalled()
  })

  test('AiError with its own message (truncation) shows that message', async () => {
    h.extract.mockRejectedValue(new AiError('invalid-output', 'Resposta truncada (max_tokens atingido). Tente com um trecho menor.'))
    renderPage()
    pick()
    fireEvent.click(await screen.findByText('Ler manual com IA'))
    expect(await screen.findByText(/Resposta truncada/)).toBeInTheDocument()
  })

  test('archived season is read-only', () => {
    h.season.status = 'archived'
    renderPage()
    expect(screen.getByText(/temporada arquivada/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Manual do jogo (PDF)')).toBeNull()
  })
})
