import { describe, it, expect } from 'vitest';
import { extractStatusIntervals, extractMembershipIntervals, historyCoversInstant, matchStatusChange, matchMemberChange } from './teamHistoryParsing.js';

function row(name, timeStamp) {
  return { Name: name, Description: '', TimeStamp: timeStamp };
}

describe('matchStatusChange / matchMemberChange', () => {
  it('matches a status-change row', () => {
    expect(matchStatusChange(row('Team set as Activated', '2026-01-01T00:00:00.000Z'))).toEqual({ status: 'Activated' });
  });

  it('matches added/removed rows', () => {
    expect(matchMemberChange(row('Jane Smith added to team', '2026-01-01T00:00:00.000Z'))).toEqual({
      name: 'Jane Smith',
      action: 'added',
    });
    expect(matchMemberChange(row('Jane Smith removed from team', '2026-01-01T00:00:00.000Z'))).toEqual({
      name: 'Jane Smith',
      action: 'removed',
    });
  });

  it('does not match unrelated rows (e.g. a resource change)', () => {
    expect(matchStatusChange(row('Resource RESCUE1 added', '2026-01-01T00:00:00.000Z'))).toBeNull();
    expect(matchMemberChange(row('Team set as Activated', '2026-01-01T00:00:00.000Z'))).toBeNull();
  });
});

describe('extractStatusIntervals', () => {
  it('builds sequential intervals, oldest first, last one open-ended', () => {
    const rows = [
      row('Team set as Activated', '2026-01-02T00:00:00.000Z'),
      row('Team set as On Alert', '2026-01-01T00:00:00.000Z'),
      row('Team set as Rest', '2026-01-03T00:00:00.000Z'),
    ];
    const intervals = extractStatusIntervals(rows);
    expect(intervals).toEqual([
      { status: 'On Alert', start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-01-02T00:00:00.000Z') },
      { status: 'Activated', start: new Date('2026-01-02T00:00:00.000Z'), end: new Date('2026-01-03T00:00:00.000Z') },
      { status: 'Rest', start: new Date('2026-01-03T00:00:00.000Z'), end: null },
    ]);
  });

  it('captures multiple separate Activated intervals for one team (re-activation)', () => {
    const rows = [
      row('Team set as Activated', '2026-01-01T00:00:00.000Z'),
      row('Team set as Rest', '2026-01-02T00:00:00.000Z'),
      row('Team set as Activated', '2026-01-05T00:00:00.000Z'),
    ];
    const activated = extractStatusIntervals(rows).filter((i) => i.status === 'Activated');
    expect(activated).toHaveLength(2);
    expect(activated[1].end).toBeNull();
  });
});

describe('extractMembershipIntervals', () => {
  it('pairs added/removed rows into an interval', () => {
    const rows = [
      row('Jane Smith added to team', '2026-01-01T00:00:00.000Z'),
      row('Jane Smith removed from team', '2026-01-02T00:00:00.000Z'),
    ];
    expect(extractMembershipIntervals(rows)).toEqual([
      { name: 'Jane Smith', start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-01-02T00:00:00.000Z') },
    ]);
  });

  it('leaves the last interval open when there is no matching removal', () => {
    const rows = [row('Jane Smith added to team', '2026-01-01T00:00:00.000Z')];
    expect(extractMembershipIntervals(rows)[0].end).toBeNull();
  });

  it('supports repeated add/remove cycles for the same person (membership changes during the period)', () => {
    const rows = [
      row('Jane Smith added to team', '2026-01-01T00:00:00.000Z'),
      row('Jane Smith removed from team', '2026-01-02T00:00:00.000Z'),
      row('Jane Smith added to team', '2026-01-03T00:00:00.000Z'),
      row('Jane Smith removed from team', '2026-01-04T00:00:00.000Z'),
    ];
    const intervals = extractMembershipIntervals(rows);
    expect(intervals).toHaveLength(2);
    expect(intervals[0]).toEqual({ name: 'Jane Smith', start: new Date('2026-01-01T00:00:00.000Z'), end: new Date('2026-01-02T00:00:00.000Z') });
    expect(intervals[1]).toEqual({ name: 'Jane Smith', start: new Date('2026-01-03T00:00:00.000Z'), end: new Date('2026-01-04T00:00:00.000Z') });
  });

  it('tracks members independently by name', () => {
    const rows = [
      row('Jane Smith added to team', '2026-01-01T00:00:00.000Z'),
      row('John Doe added to team', '2026-01-01T00:00:00.000Z'),
      row('Jane Smith removed from team', '2026-01-02T00:00:00.000Z'),
    ];
    const intervals = extractMembershipIntervals(rows);
    expect(intervals.find((i) => i.name === 'Jane Smith').end).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(intervals.find((i) => i.name === 'John Doe').end).toBeNull();
  });

  it('drops a "removed" with no prior "added" (join predates fetched history)', () => {
    const rows = [row('Jane Smith removed from team', '2026-01-02T00:00:00.000Z')];
    expect(extractMembershipIntervals(rows)).toEqual([]);
  });
});

describe('historyCoversInstant', () => {
  it('is true when every page was fetched (results >= totalItems)', () => {
    expect(historyCoversInstant({ results: [row('x', '2026-01-05T00:00:00.000Z')], totalItems: 1 }, new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
  });

  it('is true when the oldest fetched row is at or before the instant', () => {
    const results = [row('x', '2026-01-01T00:00:00.000Z'), row('y', '2026-01-05T00:00:00.000Z')];
    expect(historyCoversInstant({ results, totalItems: 100 }, new Date('2026-01-01T00:00:00.000Z'))).toBe(true);
  });

  it('is false when the oldest fetched row is after the instant and more pages exist', () => {
    const results = [row('x', '2026-01-03T00:00:00.000Z')];
    expect(historyCoversInstant({ results, totalItems: 100 }, new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('is false for an empty page when more items exist (e.g. a failed/partial fetch)', () => {
    expect(historyCoversInstant({ results: [], totalItems: 5 }, new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
  });
});
