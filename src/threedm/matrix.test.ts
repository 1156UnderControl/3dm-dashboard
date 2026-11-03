import { describe, it, expect } from 'vitest';
import { scoreMatrix } from './matrix';

const priorities = [
  { id: 'p1', bucket: 'Precisamos' as const },
  { id: 'p2', bucket: 'Queremos' as const },
];
const attributes = [{ atributo: 'speed', peso: 1 }, { atributo: 'cost', peso: 3 }];
const base = {
  archetypes: ['A', 'B'],
  priorities,
  coverage: [
    { archetypeId: 'A', priorityId: 'p1', atende: true },
    { archetypeId: 'A', priorityId: 'p2', atende: true },
    { archetypeId: 'B', priorityId: 'p1', atende: false },
    { archetypeId: 'B', priorityId: 'p2', atende: true },
  ],
  attributes,
  scores: [
    { archetypeId: 'A', attribute: 'speed', nota: 5 },
    { archetypeId: 'A', attribute: 'cost', nota: 5 },
    { archetypeId: 'B', attribute: 'speed', nota: 5 },
    { archetypeId: 'B', attribute: 'cost', nota: 1 },
  ],
};

describe('scoreMatrix', () => {
  it('A covers all, B misses one Precisamos', () => {
    const r = scoreMatrix(base);
    expect(r.A.coveragePct).toBe(1);
    expect(r.A.missingNeeds).toEqual([]);
    expect(r.B.coveragePct).toBe(0.5);
    expect(r.B.missingNeeds).toEqual(['p1']);
  });
  it('weighted = sum(peso*nota)/(sum peso*5) and finalPct blends', () => {
    const r = scoreMatrix(base);
    expect(r.A.weighted).toBe(1);
    expect(r.A.finalPct).toBe(100);
    expect(r.B.weighted).toBeCloseTo((5 + 3) / 20);
    expect(r.B.finalPct).toBe(Math.round(100 * (0.5 + 0.4) / 2)); // 45
  });
  it('weights summing to 0 -> weighted 0, no NaN', () => {
    const r = scoreMatrix({ ...base, attributes: [{ atributo: 'speed', peso: 0 }] });
    expect(r.A.weighted).toBe(0);
    expect(Number.isNaN(r.A.finalPct)).toBe(false);
    expect(r.A.finalPct).toBe(50);
  });
  it('no priorities -> coveragePct 1', () => {
    const r = scoreMatrix({ ...base, priorities: [], coverage: [] });
    expect(r.A.coveragePct).toBe(1);
    expect(r.A.missingNeeds).toEqual([]);
  });
  it('missing coverage entry counts as not covered; Queremos not in missingNeeds', () => {
    const r = scoreMatrix({ ...base, coverage: [] });
    expect(r.A.coveragePct).toBe(0);
    expect(r.A.missingNeeds).toEqual(['p1']);
  });
  it('missing score counts as nota 0', () => {
    const r = scoreMatrix({ ...base, scores: [] });
    expect(r.A.weighted).toBe(0);
  });
});
