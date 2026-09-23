import { describe, it, expect } from 'vitest';
import { mergeLogEntries, entryMatchesScope } from './mergeLogEntries.js';

const entry = (id, timeLogged, overrides = {}) => ({ Id: id, TimeLogged: timeLogged, ...overrides });

describe('mergeLogEntries', () => {
  it('adds new entries and sorts newest-logged-first', () => {
    const merged = mergeLogEntries([], [entry(1, '2026-01-01T00:00:00.000Z'), entry(2, '2026-01-02T00:00:00.000Z')]);
    expect(merged.map((e) => e.Id)).toEqual([2, 1]);
  });

  it('deduplicates by id -- a pushed update replaces the existing row rather than duplicating it', () => {
    const existing = [entry(1, '2026-01-01T00:00:00.000Z', { Text: 'original' })];
    const merged = mergeLogEntries(existing, [entry(1, '2026-01-01T00:00:00.000Z', { Text: 'resolved' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].Text).toBe('resolved');
  });

  it('does not mutate its inputs', () => {
    const existing = [entry(1, '2026-01-01T00:00:00.000Z')];
    const incoming = [entry(2, '2026-01-02T00:00:00.000Z')];
    mergeLogEntries(existing, incoming);
    expect(existing).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });

  it('merges an empty incoming list as a no-op', () => {
    const existing = [entry(1, '2026-01-01T00:00:00.000Z')];
    expect(mergeLogEntries(existing, [])).toEqual(existing);
  });
});

describe('entryMatchesScope', () => {
  it('matches when no scope filters are set', () => {
    expect(entryMatchesScope(entry(1, '2026-01-01T00:00:00.000Z'), {})).toBe(true);
  });

  it('filters by entity/HQ id', () => {
    const e = entry(1, '2026-01-01T00:00:00.000Z', { Entity: { Id: 5 } });
    expect(entryMatchesScope(e, { entityIds: [5] })).toBe(true);
    expect(entryMatchesScope(e, { entityIds: [9] })).toBe(false);
  });

  it('filters by job/event association', () => {
    const e = entry(1, '2026-01-01T00:00:00.000Z', { JobId: 'job1', EventId: 'event1' });
    expect(entryMatchesScope(e, { jobIds: ['job1'] })).toBe(true);
    expect(entryMatchesScope(e, { jobIds: ['job2'] })).toBe(false);
    expect(entryMatchesScope(e, { eventIds: ['event1'] })).toBe(true);
    expect(entryMatchesScope(e, { eventIds: ['event2'] })).toBe(false);
  });

  it('filters by tag (e.g. the default "radio tag only" scope)', () => {
    const e = entry(1, '2026-01-01T00:00:00.000Z', { Tags: [{ Id: 6 }, { Id: 42 }] });
    expect(entryMatchesScope(e, { tagIds: [6] })).toBe(true);
    expect(entryMatchesScope(e, { tagIds: [99] })).toBe(false);
    expect(entryMatchesScope(e, { tagIds: [] })).toBe(true);
  });

  it('excludes an entry with no Tags array when a tag filter is set', () => {
    const e = entry(1, '2026-01-01T00:00:00.000Z');
    expect(entryMatchesScope(e, { tagIds: [6] })).toBe(false);
  });

  it('filters by the closed end of a date window -- a SignalR push after windowEndInput must not silently grow a bounded view', () => {
    const e = entry(1, '2026-01-01T12:00:00.000Z');
    expect(entryMatchesScope(e, { dateTo: new Date('2026-01-01T13:00:00.000Z') })).toBe(true);
    expect(entryMatchesScope(e, { dateTo: new Date('2026-01-01T11:00:00.000Z') })).toBe(false);
  });

  it('filters by the start of a date window', () => {
    const e = entry(1, '2026-01-01T12:00:00.000Z');
    expect(entryMatchesScope(e, { dateFrom: new Date('2026-01-01T11:00:00.000Z') })).toBe(true);
    expect(entryMatchesScope(e, { dateFrom: new Date('2026-01-01T13:00:00.000Z') })).toBe(false);
  });

  it('excludes an entry with no parseable TimeLogged when a date window is set', () => {
    const e = entry(1, null);
    expect(entryMatchesScope(e, { dateFrom: new Date('2026-01-01T00:00:00.000Z') })).toBe(false);
  });

  it('does not check dates when no date bound is set', () => {
    const e = entry(1, null);
    expect(entryMatchesScope(e, {})).toBe(true);
  });
});
