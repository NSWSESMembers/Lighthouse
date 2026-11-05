import { describe, it, expect } from 'vitest';
import { waitingRing, centreValueSize, RING_CIRCUMFERENCE, SLOW_AFTER_MS } from './loadRing.js';

describe('waitingRing', () => {
  it('spins with a waiting time', () => {
    const v = waitingRing({ startedAt: 0, now: 4200, title: 'Asking Beacon…' });
    expect(v.indeterminate).toBe(true);
    expect(v.title).toBe('Asking Beacon…');
    expect(v.meta).toBe('waiting 4 s');
    expect(v.slow).toBe(false);
    expect(v.centreValue).toBe('');
    expect(v.ringOffset).toBeCloseTo(RING_CIRCUMFERENCE * 0.75);
  });

  it('says it is still waiting after 10 s', () => {
    const v = waitingRing({ startedAt: 0, now: SLOW_AFTER_MS, title: 'Asking Beacon…' });
    expect(v.slow).toBe(true);
    expect(v.title).toBe('Still waiting for Beacon');
    expect(waitingRing({ startedAt: 0, now: SLOW_AFTER_MS, title: 'a', slowTitle: 'b' }).title).toBe('b');
  });

  it('never shows a negative wait', () => {
    expect(waitingRing({ startedAt: 5000, now: 0, title: 'x' }).meta).toBe('waiting 0 s');
  });
});

describe('centreValueSize', () => {
  it('shrinks the number as it gets longer', () => {
    expect(centreValueSize('311')).toBe('30px');
    expect(centreValueSize('9,200')).toBe('24px');
    expect(centreValueSize('20,316')).toBe('20px');
    expect(centreValueSize('120,316')).toBe('17px');
  });
});
