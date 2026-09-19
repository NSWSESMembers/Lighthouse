import { describe, it, expect } from 'vitest';
import { PERIOD_PRESETS, lastNMinutes, eventRange } from './periodPresets.js';

const now = new Date('2026-09-19T10:00:00Z');

describe('period presets', () => {
  it('offers the six choices in order', () => {
    expect(PERIOD_PRESETS.map((p) => p.label)).toEqual(['Last 6 Hrs', 'Last 12 Hrs', 'Last 1 Day', 'Last 7 Days', 'Last 30 Days', 'As Per Event']);
  });
  it('counts back from now', () => {
    const r = lastNMinutes(now, 6 * 60);
    expect(r.start.toISOString()).toBe('2026-09-19T04:00:00.000Z');
    expect(r.end).toBe(now);
  });
});

describe('eventRange', () => {
  it('uses the event start, and its end when it has finished', () => {
    const r = eventRange({ StartDate: '2026-09-10T00:00:00Z', EndDate: '2026-09-12T00:00:00Z' }, now);
    expect(r.start.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-09-12T00:00:00.000Z');
  });
  it('runs to now for an ongoing event (no end, or an end in the future)', () => {
    expect(eventRange({ StartDate: '2026-09-10T00:00:00Z' }, now).end).toBe(now);
    expect(eventRange({ StartDate: '2026-09-10T00:00:00Z', EndDate: '2026-12-01T00:00:00Z' }, now).end).toBe(now);
  });
  it('is null when the event has no usable start date', () => {
    expect(eventRange({ Name: 'x' }, now)).toBeNull();
    expect(eventRange(null, now)).toBeNull();
    expect(eventRange({ StartDate: 'garbage' }, now)).toBeNull();
  });
});
