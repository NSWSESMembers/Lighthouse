import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import moment from 'moment';
import { HistoryEntry } from './HistoryEntry.js';

describe('HistoryEntry formatting', () => {
  it('formats timeLogged/timeStamp when raw values are present', () => {
    const h = new HistoryEntry({ TimeLogged: '2026-01-01T11:59:00.000Z', TimeStamp: '2026-01-02T00:00:00.000Z' });
    expect(h.timeLogged()).toBe(moment('2026-01-01T11:59:00.000Z').format('DD/MM/YYYY HH:mm:ss'));
    expect(h.timeStamp()).toBe(moment('2026-01-02T00:00:00.000Z').format('DD/MM/YYYY HH:mm:ss'));
  });

  it('is blank when the raw values are absent', () => {
    const h = new HistoryEntry({});
    expect(h.timeLogged()).toBe('');
    expect(h.timeStamp()).toBe('');
  });

  it('createdByDisplay mirrors createdBy.fullName', () => {
    const h = new HistoryEntry({ CreatedBy: { FullName: 'Jane Doe' } });
    expect(h.createdByDisplay()).toBe('Jane Doe');
  });

  it('defaults createdBy fields for a missing CreatedBy', () => {
    const h = new HistoryEntry({});
    expect(h.createdBy.firstName()).toBe('');
    expect(h.createdByDisplay()).toBe('');
  });
});

describe('HistoryEntry relative time', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('timeStampAgo/timeLoggedAgo use moment().fromNow()', () => {
    const h = new HistoryEntry({
      TimeStamp: '2026-01-01T11:00:00.000Z',
      TimeLogged: '2026-01-01T10:00:00.000Z',
    });
    expect(h.timeStampAgo()).toBe(moment('2026-01-01T11:00:00.000Z').fromNow());
    expect(h.timeLoggedAgo()).toBe(moment('2026-01-01T10:00:00.000Z').fromNow());
  });

  it('is blank with no raw timestamp', () => {
    const h = new HistoryEntry({});
    expect(h.timeStampAgo()).toBe('');
    expect(h.timeLoggedAgo()).toBe('');
  });

  it('reads deps.relativeUpdateTick as a dependency when provided', () => {
    const tick = vi.fn(() => 0);
    const h = new HistoryEntry({ TimeStamp: '2026-01-01T11:00:00.000Z' }, { relativeUpdateTick: tick });
    h.timeStampAgo();
    expect(tick).toHaveBeenCalled();
  });
});
