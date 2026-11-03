import { describe, expect, test } from 'vitest';
import { STAGES, STEPS, getStep } from './template';

describe('3DM template', () => {
  test('has 14 steps across 5 stages in order', () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      '1.1', '1.2', '1.3', '1.3.2', '1.4', '1.5', '1.6', '2', '3', '4.1', '4.2', '5.1', '5.2', '5.3',
    ]);
    expect(STAGES.map((s) => s.stage)).toEqual([1, 2, 3, 4, 5]);
    for (const s of STEPS) expect(STAGES.some((g) => g.stage === s.stage)).toBe(true);
  });

  test('every step has at least one kind and unique column keys per kind', () => {
    for (const step of STEPS) {
      expect(step.kinds.length).toBeGreaterThan(0);
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      for (const kind of step.kinds) {
        expect(kind.columns.length).toBeGreaterThan(0);
        const keys = kind.columns.map((c) => c.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const k of keys) expect(k).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
      }
    }
  });

  test('enum columns have options', () => {
    for (const step of STEPS)
      for (const kind of step.kinds)
        for (const col of kind.columns)
          if (col.type === 'enum') expect(col.options?.length ?? 0).toBeGreaterThan(0);
  });

  test('step 2 priority buckets are exactly Precisamos/Queremos/Seria bom/Ignorar', () => {
    const step = getStep('2');
    expect(step.view).toBe('priority-board');
    const bucket = step.kinds.find((k) => k.kind === 'priority')!.columns.find((c) => c.key === 'bucket')!;
    expect(bucket.options).toEqual(['Precisamos', 'Queremos', 'Seria bom', 'Ignorar']);
    expect(step.guidance).toBeTruthy();
  });

  test('special views and kinds', () => {
    expect(getStep('4.2').view).toBe('decision-matrix');
    expect(getStep('5.2').view).toBe('cad-flow');
    expect(getStep('4.2').kinds.map((k) => k.kind)).toEqual(['attribute', 'score', 'coverage', 'choice']);
  });

  test('getStep throws for unknown id', () => {
    expect(() => getStep('9')).toThrow();
    expect(getStep('1.3.2').kinds[0].kind).toBe('role-scenario');
  });
});
