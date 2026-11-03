import type { Item } from './types';

export function stepSummary(items: Item[]): { total: number; aiPending: number; rejected: number } {
  const active = items.filter((i) => i.state === 'active');
  return {
    total: active.length,
    aiPending: active.filter((i) => i.origin === 'ai').length,
    rejected: items.filter((i) => i.state === 'rejected').length,
  };
}
