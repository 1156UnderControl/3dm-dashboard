import { useState } from 'react'
import { Link } from 'react-router'
import { db } from '../../firebase'
import { useAppConfig } from '../../data/config'
import { useSeason } from '../../data/hooks'
import { createItem, createItems } from '../../data/items'
import { useTeamKeys, resolveKey } from '../../ai/keys'
import { dedupeAiItems, normalizeKey } from '../../ai/toItems'
import { AiError, aiErrorText, getProvider } from '../../ai/provider'
import { askManual, suggestForStep } from '../../ai/suggest'
import { pdfCache } from '../../ai/pdfCache'
import type { ItemKindDef, StepDef } from '../../threedm/template'
import type { Item } from '../../threedm/types'

const errText = (e: unknown, fallback: string) => (e instanceof AiError ? aiErrorText(e) : fallback)

function useAiGate(sid: string) {
  const { data: season } = useSeason(sid)
  const config = useAppConfig()
  const team = useTeamKeys()
  const hasKey = !!resolveKey(config.aiProvider, team)
  return { season, config, team, hasKey }
}

const NoKey = () => (
  <span className="text-sm text-slate-600">
    IA indisponível: <Link to="/settings/ai" className="text-blue-700 underline">configure uma chave</Link>
  </span>
)

export function SuggestBar({ sid, stepDef, kindDef, items, by, readOnly }: {
  sid: string; stepDef: StepDef; kindDef: ItemKindDef; items: Item[]; by: string; readOnly: boolean
}) {
  const { season, config, team, hasKey } = useAiGate(sid)
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  if (readOnly || season?.status === 'archived') return null
  if (!season?.model) return <p className="mb-2 text-sm text-slate-500">Rode a configuração da temporada primeiro</p>

  async function run() {
    if (!season?.model) return
    setBusy(true); setMsg('')
    try {
      const provider = getProvider(config, team)
      const fresh = await suggestForStep(provider, { step: stepDef, kind: kindDef, seasonModel: season.model, existing: items, instruction })
      if (fresh.length) await createItems(db, sid, by, fresh)
      setMsg(fresh.length ? `${fresh.length} ${fresh.length === 1 ? 'item adicionado' : 'itens adicionados'}` : 'Nada novo')
    } catch (e) {
      setMsg(errText(e, 'Não foi possível gerar sugestões.'))
    } finally { setBusy(false) }
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <input aria-label={`Instrução para sugestões de ${kindDef.label}`} placeholder="Instrução (opcional)" value={instruction}
        disabled={!hasKey || busy} onChange={(e) => setInstruction(e.target.value)} className="rounded border px-2 py-1 text-sm" />
      <button className="rounded border px-3 py-1 text-sm disabled:opacity-50" disabled={!hasKey || busy}
        onClick={() => void run()}>
        {busy ? 'Sugerindo…' : `Sugerir mais (${kindDef.label})`}
      </button>
      {!hasKey && <NoKey />}
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </div>
  )
}

export function AskManual({ sid, by, readOnly, items = [] }: { sid: string; by: string; readOnly: boolean; items?: Item[] }) {
  const { season, config, team, hasKey } = useAiGate(sid)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ q: string; answer: string; citacao: string } | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  if (readOnly || season?.status === 'archived') return null
  if (!season?.model) return <p className="mb-3 text-sm text-slate-500">Rode a configuração da temporada primeiro</p>

  async function ask() {
    if (!season?.model || !question.trim()) return
    setBusy(true); setError(''); setResult(null); setSaved(false); setSaveMsg('')
    try {
      const provider = getProvider(config, team)
      const pdf = await pdfCache.get(sid).catch(() => null)
      const r = await askManual(provider, pdf, season.model, question.trim())
      setResult({ q: question.trim(), ...r })
    } catch (e) {
      setError(errText(e, 'Não foi possível consultar o manual.'))
    } finally { setBusy(false) }
  }

  async function save() {
    if (!result) return
    const n = {
      stepId: '1.2', kind: 'question', origin: 'ai' as const, aiKey: `question:${normalizeKey('question', result.q, result.q)}`, citation: result.citacao,
      data: { pergunta: result.q, resposta: result.answer, citacao: result.citacao },
    }
    if (dedupeAiItems([n], items).length === 0) { setSaveMsg('Essa pergunta já foi salva'); return }
    try {
      await createItem(db, sid, by, n)
      setSaved(true); setSaveMsg('')
    } catch {
      setSaveMsg('Não foi possível salvar a pergunta.')
    }
  }

  return (
    <section className="mb-6 rounded border bg-white p-3">
      <h3 className="mb-2 font-semibold">Pergunte ao manual</h3>
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void ask() }}>
        <input aria-label="Pergunta ao manual" placeholder="Ex.: Posso tocar no HUB durante o autônomo?" value={question}
          disabled={!hasKey || busy} onChange={(e) => setQuestion(e.target.value)} className="min-w-64 flex-1 rounded border px-2 py-1 text-sm" />
        <button type="submit" className="rounded border px-3 py-1 text-sm disabled:opacity-50" disabled={!hasKey || busy || !question.trim()}>
          {busy ? 'Consultando…' : 'Perguntar'}
        </button>
        {!hasKey && <NoKey />}
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="mt-3 text-sm">
          <p>{result.answer}</p>
          {result.citacao && <p className="mt-1 text-slate-600">Citação: {result.citacao}</p>}
          <button className="mt-2 rounded border px-3 py-1 disabled:opacity-50" disabled={saved} onClick={() => void save()}>
            {saved ? 'Salvo' : 'Salvar como pergunta'}
          </button>
          {saveMsg && <p role="status" className="mt-1 text-slate-700">{saveMsg}</p>}
        </div>
      )}
    </section>
  )
}
