import { describe, it, expect } from 'vitest';
import { intervalOverlapsWindow, clampIntervalToWindow, intersectIntervals } from './intervals.js';

const d = (s) => new Date(s);
const windowStart = d('2026-01-01T00:00:00.000Z');
const windowEnd = d('2026-01-02T00:00:00.000Z');

describe('intervalOverlapsWindow (inclusive start, exclusive end)', () => {
  it('overlaps when fully inside the window', () => {
    expect(intervalOverlapsWindow(d('2026-01-01T06:00:00.000Z'), d('2026-01-01T18:00:00.000Z'), windowStart, windowEnd)).toBe(true);
  });

  it('overlaps an ongoing (null-end) interval that started before the window', () => {
    expect(intervalOverlapsWindow(d('2025-12-01T00:00:00.000Z'), null, windowStart, windowEnd)).toBe(true);
  });

  it('does NOT overlap when the interval starts exactly at windowEnd (window end is exclusive)', () => {
    expect(intervalOverlapsWindow(windowEnd, d('2026-01-03T00:00:00.000Z'), windowStart, windowEnd)).toBe(false);
  });

  it('DOES overlap when the interval starts exactly at windowStart (window start is inclusive)', () => {
    expect(intervalOverlapsWindow(windowStart, d('2026-01-01T01:00:00.000Z'), windowStart, windowEnd)).toBe(true);
  });

  it('does NOT overlap when the interval ends exactly at windowStart', () => {
    expect(intervalOverlapsWindow(d('2025-12-31T00:00:00.000Z'), windowStart, windowStart, windowEnd)).toBe(false);
  });

  it('does not overlap an interval entirely before or after the window', () => {
    expect(intervalOverlapsWindow(d('2025-01-01T00:00:00.000Z'), d('2025-01-02T00:00:00.000Z'), windowStart, windowEnd)).toBe(false);
    expect(intervalOverlapsWindow(d('2027-01-01T00:00:00.000Z'), d('2027-01-02T00:00:00.000Z'), windowStart, windowEnd)).toBe(false);
  });
});

describe('clampIntervalToWindow', () => {
  it('clamps an interval that spans both boundaries', () => {
    expect(clampIntervalToWindow(d('2025-12-01T00:00:00.000Z'), d('2026-01-05T00:00:00.000Z'), windowStart, windowEnd)).toEqual({
      start: windowStart,
      end: windowEnd,
    });
  });

  it('returns null when there is no overlap', () => {
    expect(clampIntervalToWindow(d('2027-01-01T00:00:00.000Z'), d('2027-01-02T00:00:00.000Z'), windowStart, windowEnd)).toBeNull();
  });
});

describe('intersectIntervals', () => {
  it('intersects two overlapping open intervals', () => {
    const a = { start: d('2026-01-01T00:00:00.000Z'), end: null };
    const b = { start: d('2026-01-01T06:00:00.000Z'), end: d('2026-01-01T12:00:00.000Z') };
    expect(intersectIntervals(a, b)).toEqual({ start: d('2026-01-01T06:00:00.000Z'), end: d('2026-01-01T12:00:00.000Z') });
  });

  it('returns null for non-overlapping intervals', () => {
    const a = { start: d('2026-01-01T00:00:00.000Z'), end: d('2026-01-01T06:00:00.000Z') };
    const b = { start: d('2026-01-01T06:00:00.000Z'), end: d('2026-01-01T12:00:00.000Z') };
    expect(intersectIntervals(a, b)).toBeNull(); // half-open: touching at the boundary is not an overlap
  });
});
