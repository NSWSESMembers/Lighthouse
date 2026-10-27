import { describe, it, expect } from 'vitest';
import { describeLoad, estimateMsLeft, etaText, centreValueSize, RING_CIRCUMFERENCE, SLOW_AFTER_MS } from './loadProgress.js';

const base = { startedAt: 0, firstPageAt: null, lastPageAt: null };

describe('describeLoad', () => {
  it('spins with a waiting time before Beacon gives a total', () => {
    const v = describeLoad({ ...base, phase: 'starting', loaded: 0, total: null, now: 4200 });
    expect(v.indeterminate).toBe(true);
    expect(v.title).toBe('Asking Beacon for incidents…');
    expect(v.meta).toBe('waiting 4 s');
    expect(v.slow).toBe(false);
    expect(v.centreValue).toBe('');
  });

  it('says it is still waiting after 10 s', () => {
    const v = describeLoad({ ...base, phase: 'starting', loaded: 0, total: null, now: SLOW_AFTER_MS });
    expect(v.slow).toBe(true);
    expect(v.title).toBe('Still waiting for Beacon');
  });

  it('counts incidents and pages once the total is known', () => {
    const v = describeLoad({ ...base, phase: 'incidents', loaded: 200, total: 311, firstPageAt: 1000, lastPageAt: 2000, now: 2000 });
    expect(v.indeterminate).toBe(false);
    expect(v.centreValue).toBe('200');
    expect(v.centreLabel).toBe('of 311');
    expect(v.centreLabel2).toBe('incidents');
    expect(v.pageDots.map((d) => d.done)).toEqual([true, true, false, false]);
    expect(v.meta).toBe('page 2 of 4 · about 2 s left');
    expect(v.ringOffset).toBeCloseTo(RING_CIRCUMFERENCE * (1 - 200 / 311));
    expect(v.ariaNow).toBe(64);
  });

  it('uses a bar instead of dots for many pages, and formats big numbers', () => {
    const v = describeLoad({ ...base, phase: 'incidents', loaded: 1500, total: 4310, firstPageAt: 0, lastPageAt: 0, now: 0 });
    expect(v.pageDots).toEqual([]);
    expect(v.showPageBar).toBe(true);
    expect(v.pageBarPct).toBe(Math.round((15 / 44) * 100));
    expect(v.centreValue).toBe('1,500');
    expect(v.centreLabel).toBe('of 4,310');
  });

  it('shows a full ring while building charts', () => {
    const v = describeLoad({ ...base, phase: 'charts', loaded: 311, total: 311, now: 0 });
    expect(v.title).toBe('Building charts…');
    expect(v.ringOffset).toBe(0);
    expect(v.meta).toBe('311 incidents loaded');
  });

  it('copes with no incidents and with one', () => {
    expect(describeLoad({ ...base, phase: 'incidents', loaded: 0, total: 0, now: 0 }).ringOffset).toBe(0);
    expect(describeLoad({ ...base, phase: 'charts', loaded: 1, total: 1, now: 0 }).centreLabel2).toBe('incident');
  });
});

describe('centreValueSize', () => {
  it('shrinks the number as it gets longer', () => {
    expect(centreValueSize('311')).toBe('30px');
    expect(centreValueSize('9,193')).toBe('24px');
    expect(centreValueSize('20,316')).toBe('20px');
    expect(centreValueSize('120,316')).toBe('17px');
  });
});

describe('estimateMsLeft', () => {
  it('needs two pages to estimate', () => {
    expect(estimateMsLeft({ pagesDone: 1, pages: 4, firstPageAt: 0, lastPageAt: 0, now: 0 })).toBeNull();
  });

  it('averages page time since the first page and takes off time since the last', () => {
    // pages 1..3 at 0, 1000, 2000 ms: 1 s each, 7 left, 400 ms since the last
    expect(estimateMsLeft({ pagesDone: 3, pages: 10, firstPageAt: 0, lastPageAt: 2000, now: 2400 })).toBe(6600);
  });

  it('is null when done and never under a second', () => {
    expect(estimateMsLeft({ pagesDone: 4, pages: 4, firstPageAt: 0, lastPageAt: 3000, now: 3000 })).toBeNull();
    expect(estimateMsLeft({ pagesDone: 2, pages: 3, firstPageAt: 0, lastPageAt: 100, now: 5000 })).toBe(1000);
  });
});

describe('etaText', () => {
  it('shows seconds, then minutes', () => {
    expect(etaText(6000)).toBe('about 6 s left');
    expect(etaText(200)).toBe('about 1 s left');
    expect(etaText(150000)).toBe('about 3 min left');
  });
});
