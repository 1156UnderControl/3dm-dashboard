import { describe, it, expect } from 'vitest';
import { cadBudget } from './budget';

describe('cadBudget', () => {
  it('sums peso_kg, ignoring missing', () =>
    expect(cadBudget([{ peso_kg: 15 }, { peso_kg: 14 }, {}], 52.16)).toEqual({ used: 29, remaining: 23.16 }));
  it('rounds to 2 decimals', () =>
    expect(cadBudget([{ peso_kg: 0.1 }, { peso_kg: 0.2 }], 1)).toEqual({ used: 0.3, remaining: 0.7 }));
  it('goes negative when over budget', () =>
    expect(cadBudget([{ peso_kg: 60 }], 52.16)).toEqual({ used: 60, remaining: -7.84 }));
  it('empty rows', () => expect(cadBudget([], 52.16)).toEqual({ used: 0, remaining: 52.16 }));
});
