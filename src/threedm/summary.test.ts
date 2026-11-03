import { describe, it, expect } from 'vitest';
import { stepSummary } from './summary';
import type { Item } from './types';

const mk = (o: Partial<Item>): Item => ({
  id: 'x', stepId: 's', kind: 'k', data: {}, origin: 'human', state: 'active', order: 0,
  createdBy: 'a', updatedBy: 'a', updatedAt: 0, ...o,
});

describe('stepSummary', () => {
  it('counts active, ai pending, rejected', () => {
    const ai = mk({ origin: 'ai' });
    const aiRejected = mk({ origin: 'ai', state: 'rejected' });
    const human = mk({});
    expect(stepSummary([ai, aiRejected, human])).toEqual({ total: 2, aiPending: 1, rejected: 1 });
  });
  it('accepted/edited ai items are not pending', () => {
    expect(stepSummary([mk({ origin: 'ai-accepted' }), mk({ origin: 'ai-edited' })]))
      .toEqual({ total: 2, aiPending: 0, rejected: 0 });
  });
  it('empty', () => expect(stepSummary([])).toEqual({ total: 0, aiPending: 0, rejected: 0 }));
});
