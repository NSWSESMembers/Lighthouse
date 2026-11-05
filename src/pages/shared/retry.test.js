import { describe, it, expect } from 'vitest';
import { retryDelay } from './retry.js';

describe('retryDelay', () => {
  const timing = { refresh: 180, first: 60, max: 600 };

  it('is the normal refresh period when nothing failed', () => {
    expect(retryDelay(0, timing)).toBe(180);
  });

  it('starts at `first` and doubles up to `max`', () => {
    expect([1, 2, 3, 4, 5, 10].map((n) => retryDelay(n, timing))).toEqual([60, 120, 240, 480, 600, 600]);
  });

  it('can retry sooner than the refresh period, or later', () => {
    expect(retryDelay(1, { refresh: 30, first: 30, max: 300 })).toBe(30);
    expect(retryDelay(3, { refresh: 30, first: 30, max: 300 })).toBe(120);
  });
});
