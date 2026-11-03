import { useState } from 'react'
import { z } from 'zod'
import { useCurrentMember } from '../../auth/context'
import { clearKey, getKey, keyHint, resolveKey, setKey, setTeamKey, useTeamKeys, type ProviderId } from '../../ai/keys'
import { AiError, aiErrorMessage, getProviderWithKey } from '../../ai/provider'
import { DEFAULT_MODELS, setAppConfig, useAppConfig } from '../../data/config'
import { db } from '../../firebase'

const PROVIDER_LABEL: Record<ProviderId, string> = { anthropic: 'Anthropic', openai: 'OpenAI' }
const pingSchema = z.object({ ok: z.boolean() })

async function ping(provider: ProviderId, model: string, key: string | null): Promise<string> {
  if (!key) return aiErrorMessage('no-key')
  try {
    await getProviderWithKey({ aiProvider: provider, model }, key).generate({
      system: 'Responda chamando a ferramenta com ok=true.',
      content: [{ type: 'text', text: 'ping' }],
      schema: pingSchema, schemaName: 'ping', maxTokens: 1024,
    })
    return 'Chave funcionando.'
  } catch (e) {
    // invalid-output (e.g. reasoning model ran out of tokens) means the key itself was accepted.
    if (e instanceof AiError && e.code === 'invalid-output') return 'Chave funcionando.'
    return e instanceof AiError ? aiErrorMessage(e.code) : aiErrorMessage('network')
  }
}

export default function AiSettings() {
  const { user, member } = useCurrentMember()
  const isAdmin = member?.role === 'admin'
  const config = useAppConfig()
  const team = useTeamKeys()
  const [, bump] = useState(0)
  const [draft, setDraft] = useState('')
  const [teamDraft, setTeamDraft] = useState('')
  const [model, setModel] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [teamMsg, setTeamMsg] = useState('')
  const p = config.aiProvider
  const personal = getKey(p)
  const active = resolveKey(p, team)
  const by = user?.email ?? ''

  const savePersonal = () => { if (draft.trim()) { setKey(p, draft.trim()); setDraft(''); setMsg(''); bump((n) => n + 1) } }
  const removePersonal = () => { clearKey(p); setMsg(''); bump((n) => n + 1) }
  const changeConfig = (aiProvider: ProviderId, m: string) => setAppConfig(db, { aiProvider, model: m })

  return (
    <div className="max-w-xl space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">IA</h2>
        <p className="text-sm text-slate-700">Provedor: {PROVIDER_LABEL[p]} · Modelo: <span className="font-mono">{config.model}</span></p>
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">Provedor
              <select className="ml-2 rounded border px-2 py-1" value={p}
                onChange={(e) => { const np = e.target.value as ProviderId; setModel(null); void changeConfig(np, DEFAULT_MODELS[np]) }}>
                <option value="anthropic">Anthropic</option><option value="openai">OpenAI</option>
              </select>
            </label>
            <label className="text-sm">Modelo
              <input className="ml-2 rounded border px-2 py-1 font-mono" value={model ?? config.model} onChange={(e) => setModel(e.target.value)}
                onBlur={() => { if (model && model !== config.model) void changeConfig(p, model.trim()) }} />
            </label>
          </div>
        )}
        <p className="text-sm font-medium" data-testid="active-key">
          {active ? `Usando: chave ${active.source === 'pessoal' ? 'pessoal' : 'da equipe'}` : aiErrorMessage('no-key')}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Chave pessoal ({PROVIDER_LABEL[p]})</h3>
        <p className="text-sm text-slate-600">A chave fica salva só neste navegador. Use uma chave com limite de gasto baixo.</p>
        {personal && <p className="font-mono text-sm" data-testid="personal-hint">{keyHint(personal)}</p>}
        <div className="flex gap-2">
          <input type="password" autoComplete="off" aria-label="Chave pessoal" className="flex-1 rounded border px-2 py-1"
            value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={personal ? 'Substituir chave' : 'Colar chave'} />
          <button className="rounded bg-slate-800 px-3 py-1 text-white" onClick={savePersonal}>Salvar</button>
        </div>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={!active}
            onClick={async () => { setMsg('Testando…'); setMsg(await ping(p, config.model, personal ?? team[p] ?? null)) }}>Testar chave</button>
          <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={!personal} onClick={removePersonal}>Remover chave</button>
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </section>

      {isAdmin && (
        <section className="space-y-2">
          <h3 className="font-semibold">Chave da equipe ({PROVIDER_LABEL[p]})</h3>
          <p className="text-sm text-slate-600">Todos os membros da 1156 poderão usar a IA com esta chave. Use uma chave com limite de gasto e troque se alguém sair da equipe.</p>
          {team[p] && <p className="font-mono text-sm" data-testid="team-hint">{keyHint(team[p]!)}</p>}
          <div className="flex gap-2">
            <input type="password" autoComplete="off" aria-label="Chave da equipe" className="flex-1 rounded border px-2 py-1"
              value={teamDraft} onChange={(e) => setTeamDraft(e.target.value)} placeholder={team[p] ? 'Substituir chave da equipe' : 'Colar chave da equipe'} />
            <button className="rounded bg-slate-800 px-3 py-1 text-white"
              onClick={async () => { if (teamDraft.trim()) { await setTeamKey(db, by, p, teamDraft.trim()); setTeamDraft(''); setTeamMsg('') } }}>Salvar chave da equipe</button>
          </div>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={!team[p]}
              onClick={async () => { setTeamMsg('Testando…'); setTeamMsg(await ping(p, config.model, team[p] ?? null)) }}>Testar chave da equipe</button>
            <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={!team[p]}
              onClick={async () => { await setTeamKey(db, by, p, null); setTeamMsg('') }}>Remover chave da equipe</button>
          </div>
          {teamMsg && <p role="status" className="text-sm">{teamMsg}</p>}
        </section>
      )}
    </div>
  )
}
