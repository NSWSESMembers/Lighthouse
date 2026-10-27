import { describe, it, expect } from 'vitest';
import { summarizeDurations, formatDuration } from './durations.js';

const H = 3600 * 1000;

describe('summarizeDurations', () => {
  it('ignores zeros (no completion time)', () => {
    expect(summarizeDurations([0, 0, H]).count).toBe(1);
  });

  it('splits into quickest 20%, middle 60%, slowest 20%', () => {
    // 1..10 hours, in no particular order
    const d = summarizeDurations([5, 1, 9, 3, 7, 2, 10, 4, 8, 6].map((x) => x * H));
    expect(d.count).toBe(10);
    expect(d.fastMean).toBe(1.5 * H);   // 1, 2
    expect(d.typicalMean).toBe(5.5 * H); // 3..8
    expect(d.slowMean).toBe(9.5 * H);   // 9, 10
  });

  it('gives the 25th/50th/75th percentiles in the right order', () => {
    const d = summarizeDurations([4, 1, 3, 2, 5].map((x) => x * H));
    expect(d.p25).toBe(2 * H);
    expect(d.p50).toBe(3 * H);
    expect(d.p75).toBe(4 * H);
    expect(d.p25).toBeLessThan(d.p75);
  });

  it('uses every job as the middle band when there are too few', () => {
    const d = summarizeDurations([H, 3 * H]);
    expect(d.typicalMean).toBe(2 * H);
  });

  it('is empty-safe', () => {
    const d = summarizeDurations([]);
    expect(d.count).toBe(0);
    expect(d.fastMean).toBeUndefined();
    expect(d.p50).toBeUndefined();
  });
});

describe('formatDuration', () => {
  it('rounds to the two largest of days/hours/minutes', () => {
    expect(formatDuration(2 * H + 15 * 60 * 1000 + 20 * 1000)).toBe('2 hours, 15 minutes');
    expect(formatDuration(26 * H + 20 * 60 * 1000)).toBe('1 day, 2 hours');
    expect(formatDuration(45 * 60 * 1000)).toBe('45 minutes');
  });

  it('shows a dash for nothing', () => {
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(NaN)).toBe('—');
  });
});
