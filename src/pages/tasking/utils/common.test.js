import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeStr, fmtRelative, canon } from './common.js';

describe('safeStr', () => {
  it('stringifies non-null values', () => {
    expect(safeStr(5)).toBe('5');
    expect(safeStr(true)).toBe('true');
  });

  it('returns "" for null/undefined', () => {
    expect(safeStr(null)).toBe('');
    expect(safeStr(undefined)).toBe('');
  });
});

describe('canon', () => {
  it('uppercases and strips non-alphanumeric characters', () => {
    expect(canon('rescue-1a b')).toBe('RESCUE1AB');
  });

  it('returns "" for null/undefined/empty', () => {
    expect(canon(null)).toBe('');
    expect(canon(undefined)).toBe('');
    expect(canon('')).toBe('');
  });

  it('coerces a non-string input', () => {
    expect(canon(123)).toBe('123');
  });
});

describe('fmtRelative', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-08T12:00:00.000Z')); // a Thursday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "" for an invalid date', () => {
    expect(fmtRelative(new Date('not-a-date'))).toBe('');
  });

  it.each([
    [0, '0s ago'],
    [30, '30s ago'],
    [90, '1m ago'],
    [3600, '1h ago'],
    [3660, '1h ago'], // hours truncate, don't carry minutes
  ])('formats %i seconds ago as %s', (seconds, expected) => {
    expect(fmtRelative(new Date(Date.now() - seconds * 1000))).toBe(expected);
  });

  it('formats exactly 1 day ago as "yesterday"', () => {
    expect(fmtRelative(new Date(Date.now() - 24 * 3600 * 1000))).toBe('yesterday');
  });

  it('formats 3 days ago in days', () => {
    expect(fmtRelative(new Date(Date.now() - 3 * 24 * 3600 * 1000))).toBe('3d ago');
  });

  it('formats a week or more in weeks', () => {
    expect(fmtRelative(new Date(Date.now() - 9 * 24 * 3600 * 1000))).toBe('1w ago');
  });

  it('clamps a future date to 0s ago rather than going negative', () => {
    expect(fmtRelative(new Date(Date.now() + 60_000))).toBe('0s ago');
  });
});
