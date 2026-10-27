import { describe, it, expect } from 'vitest';
import { describeLoad } from './loadProgress.js';

describe('stats describeLoad', () => {
  it('finishes with "Building charts…"', () => {
    const v = describeLoad({ phase: 'charts', loaded: 311, total: 311, startedAt: 0, now: 0 });
    expect(v.title).toBe('Building charts…');
    expect(v.ringOffset).toBe(0);
    expect(v.meta).toBe('311 incidents loaded');
  });
});
