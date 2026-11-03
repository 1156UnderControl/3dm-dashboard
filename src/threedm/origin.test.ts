import { describe, it, expect } from 'vitest';
import { nextOrigin } from './origin';

describe('nextOrigin', () => {
  it('ai + accept -> ai-accepted', () => expect(nextOrigin('ai', 'accept')).toBe('ai-accepted'));
  it('ai + edit -> ai-edited', () => expect(nextOrigin('ai', 'edit')).toBe('ai-edited'));
  it('ai-accepted + edit -> ai-edited', () => expect(nextOrigin('ai-accepted', 'edit')).toBe('ai-edited'));
  it('ai-edited stays ai-edited', () => {
    expect(nextOrigin('ai-edited', 'edit')).toBe('ai-edited');
    expect(nextOrigin('ai-edited', 'accept')).toBe('ai-edited');
  });
  it('ai-accepted + accept stays', () => expect(nextOrigin('ai-accepted', 'accept')).toBe('ai-accepted'));
  it('human stays human', () => {
    expect(nextOrigin('human', 'edit')).toBe('human');
    expect(nextOrigin('human', 'accept')).toBe('human');
  });
});
