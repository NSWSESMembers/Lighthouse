import { describe, it, expect } from 'vitest';
import { createLiveLogBuffer } from './liveLogBuffer.js';

const entry = (id, timeLogged, overrides = {}) => ({ Id: id, TimeLogged: timeLogged, ...overrides });

describe('createLiveLogBuffer', () => {
  it('starts empty and not paused', () => {
    const buffer = createLiveLogBuffer();
    expect(buffer.getDisplayed()).toEqual([]);
    expect(buffer.isPaused()).toBe(false);
  });

  it('applyPage replaces the displayed set', () => {
    const buffer = createLiveLogBuffer();
    buffer.applyPage([entry(1, '2026-01-01T00:00:00.000Z')]);
    expect(buffer.getDisplayed()).toHaveLength(1);
    buffer.applyPage([entry(2, '2026-01-02T00:00:00.000Z')]);
    expect(buffer.getDisplayed().map((e) => e.Id)).toEqual([2]);
  });

  it('applyLive merges into the displayed set when not paused', () => {
    const buffer = createLiveLogBuffer();
    buffer.applyPage([entry(1, '2026-01-01T00:00:00.000Z')]);
    buffer.applyLive([entry(2, '2026-01-02T00:00:00.000Z')]);
    expect(buffer.getDisplayed().map((e) => e.Id)).toEqual([2, 1]);
  });

  it('buffers applyLive without touching displayed while paused, and reports a pending count', () => {
    const buffer = createLiveLogBuffer();
    buffer.applyPage([entry(1, '2026-01-01T00:00:00.000Z')]);
    buffer.pause();
    buffer.applyLive([entry(2, '2026-01-02T00:00:00.000Z')]);

    expect(buffer.getDisplayed().map((e) => e.Id)).toEqual([1]); // unchanged while paused
    expect(buffer.pendingCount()).toBe(1);
  });

  it('resume flushes the pending buffer into displayed and unpauses', () => {
    const buffer = createLiveLogBuffer();
    buffer.applyPage([entry(1, '2026-01-01T00:00:00.000Z')]);
    buffer.pause();
    buffer.applyLive([entry(2, '2026-01-02T00:00:00.000Z')]);

    buffer.resume();

    expect(buffer.isPaused()).toBe(false);
    expect(buffer.getDisplayed().map((e) => e.Id).sort()).toEqual([1, 2]);
    expect(buffer.pendingCount()).toBe(0);
  });

  it('applyPage (a manual refresh or filter change) takes effect immediately even while paused', () => {
    const buffer = createLiveLogBuffer();
    buffer.applyPage([entry(1, '2026-01-01T00:00:00.000Z')]);
    buffer.pause();
    buffer.applyPage([entry(3, '2026-01-03T00:00:00.000Z')]);

    expect(buffer.getDisplayed().map((e) => e.Id)).toEqual([3]);
    expect(buffer.pendingCount()).toBe(0); // the filter change superseded whatever was pending
  });

  it('deduplicates a live update to an already-displayed entry rather than pending a duplicate', () => {
    const buffer = createLiveLogBuffer();
    buffer.applyPage([entry(1, '2026-01-01T00:00:00.000Z', { Text: 'original' })]);
    buffer.applyLive([entry(1, '2026-01-01T00:00:00.000Z', { Text: 'resolved' })]);
    expect(buffer.getDisplayed()).toHaveLength(1);
    expect(buffer.getDisplayed()[0].Text).toBe('resolved');
  });
});
