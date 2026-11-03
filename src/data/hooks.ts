import { useEffect, useState } from 'react'
import {
  limit, onSnapshot, orderBy, query, where, type DocumentData, type Query, type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Group, HistoryEvent, Item, Member, Season, StepState } from '../threedm/types'
import { groupsCol, historyCol, itemsCol, membersCol, seasonDoc, seasonsCol, stepsCol } from './paths'

export interface Live<T> { data: T; loading: boolean; error: Error | null }

function useQuery<T>(make: (() => Query<DocumentData> | null) | null, map: (d: QueryDocumentSnapshot) => T, deps: unknown[]): Live<T[]> {
  const [state, setState] = useState<Live<T[]>>({ data: [], loading: true, error: null })
  useEffect(() => {
    const q = make?.() ?? null
    if (!q) { setState({ data: [], loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map(map), loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}

const withId = <T,>(d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }) as T

export const useSeasons = () => useQuery<Season>(() => query(seasonsCol(db), orderBy('createdAt', 'desc')), withId, [])

export function useSeason(sid: string | undefined): Live<Season | null> {
  const [state, setState] = useState<Live<Season | null>>({ data: null, loading: true, error: null })
  useEffect(() => {
    if (!sid) { setState({ data: null, loading: false, error: null }); return }
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      seasonDoc(db, sid),
      (snap) => setState({ data: snap.exists() ? ({ ...snap.data(), id: snap.id } as Season) : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    )
  }, [sid])
  return state
}

export const useSteps = (sid: string | undefined) =>
  useQuery<StepState>(sid ? () => stepsCol(db, sid) : null, (d) => d.data() as StepState, [sid])

export const useItems = (sid: string | undefined, stepId: string | undefined) =>
  useQuery<Item>(sid && stepId ? () => query(itemsCol(db, sid), where('stepId', '==', stepId)) : null, withId, [sid, stepId])

export const useHistory = (sid: string | undefined, filter: { stepId?: string; itemId?: string } = {}) =>
  useQuery<HistoryEvent & { id: string }>(
    sid ? () => {
      const c: QueryConstraint[] = []
      if (filter.stepId) c.push(where('stepId', '==', filter.stepId))
      if (filter.itemId) c.push(where('itemId', '==', filter.itemId))
      return query(historyCol(db, sid), ...c, orderBy('at', 'desc'), limit(200))
    } : null,
    withId, [sid, filter.stepId, filter.itemId],
  )

export const useMembers = () => useQuery<Member>(() => membersCol(db), (d) => d.data() as Member, [])

export const useGroups = (sid: string | undefined) =>
  useQuery<Group>(sid ? () => groupsCol(db, sid) : null, withId, [sid])

/** One listener over active AI-origin items; counts per step (same semantics as stepSummary().aiPending). */
export function useAiPendingCounts(sid: string | undefined): Record<string, number> {
  const { data } = useQuery<Pick<Item, 'stepId'>>(
    sid ? () => query(itemsCol(db, sid), where('origin', '==', 'ai'), where('state', '==', 'active')) : null,
    (d) => ({ stepId: d.data().stepId as string }),
    [sid],
  )
  const counts: Record<string, number> = {}
  for (const i of data) counts[i.stepId] = (counts[i.stepId] ?? 0) + 1
  return counts
}
