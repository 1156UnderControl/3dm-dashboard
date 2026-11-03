import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import { db as appDb } from '../firebase'
import type { AppConfig } from '../threedm/types'

export const DEFAULT_APP_CONFIG: AppConfig = { aiProvider: 'anthropic', model: 'claude-sonnet-5-5' }
export const DEFAULT_MODELS: Record<AppConfig['aiProvider'], string> = { anthropic: 'claude-sonnet-5-5', openai: 'gpt-5.1' }

export const appConfigDoc = (db: Firestore) => doc(db, 'config', 'app')

/** Live `config/app`; falls back to the default when missing. */
export function useAppConfig(): AppConfig {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_APP_CONFIG)
  useEffect(() => onSnapshot(
    appConfigDoc(appDb),
    (snap) => {
      const d = snap.data() as Partial<AppConfig> | undefined
      setCfg({
        aiProvider: d?.aiProvider === 'openai' ? 'openai' : 'anthropic',
        model: d?.model || DEFAULT_APP_CONFIG.model,
      })
    },
    () => setCfg(DEFAULT_APP_CONFIG),
  ), [])
  return cfg
}

/** Admin only (rules). */
export const setAppConfig = (db: Firestore, cfg: AppConfig) => setDoc(appConfigDoc(db), cfg)
