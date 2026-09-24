import { describe, it, expect } from 'vitest';
import { assessConnection, RECONNECT_GRACE_MS, FIRST_CONNECT_ALLOWANCE_MS, REFRESH_FAILURES_LOST } from './connectionHealth.js';

const now = 1_000_000_000_000;
const base = { signalrExpected: true, state: 'connected', everConnected: true, notConnectedSinceMs: null, refreshFailures: 0, nowMs: now };
const assess = (o) => assessConnection({ ...base, ...o });

describe('assessConnection', () => {
  it('is fine when connected and refreshing', () => {
    expect(assess({})).toEqual({ lost: false, reasons: [] });
  });

  it('ignores a brief SignalR reconnect, but not one that lasts past the grace period', () => {
    expect(assess({ state: 'reconnecting', notConnectedSinceMs: now - (RECONNECT_GRACE_MS - 1000) }).lost).toBe(false);
    const r = assess({ state: 'reconnecting', notConnectedSinceMs: now - RECONNECT_GRACE_MS });
    expect(r.lost).toBe(true);
    expect(r.reasons[0]).toMatch(/dropped/);
  });

  it('gives a first connect longer before calling it lost', () => {
    const start = { everConnected: false, state: 'connecting' };
    expect(assess({ ...start, notConnectedSinceMs: now - 20000 }).lost).toBe(false);
    const r = assess({ ...start, notConnectedSinceMs: now - FIRST_CONNECT_ALLOWANCE_MS });
    expect(r.lost).toBe(true);
    expect(r.reasons[0]).toMatch(/hasn't connected/);
  });

  it('counts consecutive failed refreshes, one failure being a blip', () => {
    expect(assess({ refreshFailures: REFRESH_FAILURES_LOST - 1 }).lost).toBe(false);
    const r = assess({ refreshFailures: REFRESH_FAILURES_LOST });
    expect(r.lost).toBe(true);
    expect(r.reasons[0]).toMatch(/refreshed/);
  });

  it('does not treat a missing live feed as lost when none was expected (only refresh failures count)', () => {
    expect(assess({ signalrExpected: false, state: 'disconnected', everConnected: false, notConnectedSinceMs: now - 10 * 60000 }).lost).toBe(false);
    expect(assess({ signalrExpected: false, state: 'disconnected', refreshFailures: 3 }).lost).toBe(true);
  });

  it('is lost straight away when the first load of the log fails', () => {
    const r = assess({ initialLoadFailed: true, refreshFailures: 1 });
    expect(r.lost).toBe(true);
    expect(r.reasons[0]).toMatch(/couldn't be loaded/);
    expect(assess({ initialLoadFailed: false, refreshFailures: 1 }).lost).toBe(false);
  });

  it('is lost as soon as the browser reports no network, even with the live feed still up', () => {
    const r = assess({ browserOffline: true });
    expect(r.lost).toBe(true);
    expect(r.reasons[0]).toMatch(/offline/);
  });

  it('reports both reasons when both apply', () => {
    const r = assess({ state: 'disconnected', notConnectedSinceMs: now - 60000, refreshFailures: 3 });
    expect(r.reasons).toHaveLength(2);
  });
});
