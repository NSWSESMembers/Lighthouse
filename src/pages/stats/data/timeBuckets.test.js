import { describe, it, expect } from 'vitest';
import crossfilter from 'crossfilter2';
import { bucketFor, closedOrPlaceholder, cumulativeGroup, withoutEmptyBins, roundUp, NOT_CLOSED } from './timeBuckets.js';

const day = (n) => new Date(Date.UTC(2026, 9, n));

describe('bucketFor', () => {
  it('is hourly up to two weeks', () => {
    expect(bucketFor(day(1), day(15)).label).toBe('Hour');
    expect(bucketFor(day(1), day(2)).label).toBe('Hour');
  });

  it('is daily beyond two weeks', () => {
    expect(bucketFor(day(1), day(16)).label).toBe('Day');
  });

  it('floors dates to the bucket', () => {
    const b = bucketFor(day(1), day(2));
    expect(b.floor(new Date(2026, 9, 1, 10, 45))).toEqual(new Date(2026, 9, 1, 10));
  });
});

describe('closedOrPlaceholder', () => {
  it('stands in for open jobs', () => {
    expect(closedOrPlaceholder({ closed: null })).toBe(NOT_CLOSED);
    expect(closedOrPlaceholder({ closed: day(3) })).toEqual(day(3));
  });
});

describe('cumulativeGroup', () => {
  it('runs totals over time, skipping still-open jobs', () => {
    const facts = [{ closed: day(1) }, { closed: day(1) }, { closed: null }, { closed: day(3) }];
    const dim = crossfilter(facts).dimension(closedOrPlaceholder);
    const out = cumulativeGroup(dim.group()).all();
    expect(out).toEqual([
      { key: day(1), value: 2 },
      { key: day(3), value: 3 },
    ]);
  });
});

describe('withoutEmptyBins', () => {
  it('drops zero counts and the zero key', () => {
    const group = { all: () => [{ key: 0, value: 4 }, { key: 1, value: 0 }, { key: 2, value: 3 }] };
    expect(withoutEmptyBins(group).all()).toEqual([{ key: 2, value: 3 }]);
  });
});

describe('roundUp', () => {
  it('rounds up to the step', () => {
    expect(roundUp(1.21, 0.25)).toBe(1.25);
    expect(roundUp(1.0, 0.25)).toBe(1);
    expect(roundUp(2.1)).toBe(3);
    expect(roundUp(0, 1)).toBe(0);
  });
});
