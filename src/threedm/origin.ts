import type { Origin } from './types';

export function nextOrigin(origin: Origin, action: 'accept' | 'edit'): Origin {
  if (origin === 'ai') return action === 'accept' ? 'ai-accepted' : 'ai-edited';
  if (origin === 'ai-accepted' && action === 'edit') return 'ai-edited';
  return origin;
}
