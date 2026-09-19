import { describe, it, expect } from 'vitest';
import { classifyJobType, analyseJobHistory } from './jobClassification.js';

const tags = (...names) => ({ Tags: names.map((Name) => ({ Name })) });

describe('classifyJobType', () => {
  it('maps tags to a headline type, N/A when none match', () => {
    expect(classifyJobType(tags('Tree Down'))).toBe('Tree');
    expect(classifyJobType(tags('Leaking Roof'))).toBe('Leak');
    expect(classifyJobType(tags('Something else'))).toBe('N/A');
    expect(classifyJobType({})).toBe('N/A');
  });
  it('combines multiple types, sorted, once each', () => {
    expect(classifyJobType(tags('Tree Down', 'Branch Down', 'Roof Damage'))).toBe('Damage+Tree');
  });
});

describe('analyseJobHistory', () => {
  const h = (Type, Timelogged) => ({ Type, Timelogged });
  it('measures first Active to first Complete', () => {
    const r = analyseJobHistory({ JobStatusTypeHistory: [h(1, '2026-01-01T00:00:00Z'), h(2, '2026-01-01T01:00:00Z'), h(6, '2026-01-01T03:00:00Z'), h(6, '2026-01-01T09:00:00Z')] });
    expect(r.durationMs).toBe(2 * 3600 * 1000);
    expect(r.completedAt.toISOString()).toBe('2026-01-01T03:00:00.000Z');
  });
  it('has zero duration without both an Active and a Complete, but still records a cancellation as completion', () => {
    const r = analyseJobHistory({ JobStatusTypeHistory: [h(2, '2026-01-01T01:00:00Z'), h(7, '2026-01-01T02:00:00Z')] });
    expect(r.durationMs).toBe(0);
    expect(r.completedAt.toISOString()).toBe('2026-01-01T02:00:00.000Z');
  });
  it('never returns a negative duration', () => {
    expect(analyseJobHistory({ JobStatusTypeHistory: [h(6, '2026-01-01T01:00:00Z'), h(2, '2026-01-01T02:00:00Z')] }).durationMs).toBe(0);
  });
  it('copes with no history', () => {
    expect(analyseJobHistory({})).toEqual({ completedAt: null, durationMs: 0 });
  });
});
