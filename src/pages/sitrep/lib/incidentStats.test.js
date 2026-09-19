import { describe, it, expect } from 'vitest';
import { countByStatus, tally, averageCompletionTime, summariseIncidents, formatDuration } from './incidentStats.js';

const job = (status, extra = {}) => ({ JobStatusType: { Name: status }, ...extra });

describe('countByStatus', () => {
  it('groups New/Active/Tasked as outstanding, Referred on its own, and Complete/Cancelled/Rejected/Finalised as complete', () => {
    const jobs = ['New', 'Active', 'Tasked', 'Referred', 'Complete', 'Cancelled', 'Rejected', 'Finalised'].map((s) => job(s));
    expect(countByStatus(jobs)).toEqual({ received: 8, outstanding: 3, referred: 1, complete: 4, other: 0 });
  });
  it('is case-insensitive and surfaces unknown/missing statuses as other', () => {
    expect(countByStatus([job('ACTIVE'), job('Mystery'), {}])).toEqual({ received: 3, outstanding: 1, referred: 0, complete: 0, other: 2 });
  });
  it('is all zeros for no jobs', () => {
    expect(countByStatus([])).toEqual({ received: 0, outstanding: 0, referred: 0, complete: 0, other: 0 });
  });
});

describe('tally', () => {
  it('counts, most common first with ties alphabetical, blanks as N/A', () => {
    const jobs = [{ k: 'b' }, { k: 'a' }, { k: 'b' }, { k: null }, { k: 'c' }, { k: 'c' }];
    expect(tally(jobs, (j) => j.k)).toEqual([
      { label: 'b', count: 2 },
      { label: 'c', count: 2 },
      { label: 'N/A', count: 1 },
      { label: 'a', count: 1 },
    ].sort((x, y) => y.count - x.count || x.label.localeCompare(y.label)));
  });
});

describe('averageCompletionTime', () => {
  const h = (Type, Timelogged) => ({ Type, Timelogged });
  it('averages measurable durations only', () => {
    const jobs = [
      { JobStatusTypeHistory: [h(2, '2026-01-01T00:00:00Z'), h(6, '2026-01-01T01:00:00Z')] },
      { JobStatusTypeHistory: [h(2, '2026-01-01T00:00:00Z'), h(6, '2026-01-01T03:00:00Z')] },
      { JobStatusTypeHistory: [h(2, '2026-01-01T00:00:00Z')] },
    ];
    expect(averageCompletionTime(jobs)).toEqual({ averageMs: 2 * 3600 * 1000, sampleSize: 2 });
  });
  it('is null (not zero) with nothing measurable', () => {
    expect(averageCompletionTime([{}])).toEqual({ averageMs: null, sampleSize: 0 });
  });
});

describe('summariseIncidents', () => {
  it('groups incident types (Beacon JobType, else Type), priorities and localities', () => {
    const s = summariseIncidents([
      job('New', { JobType: { Name: 'Flood Support' }, JobPriorityType: { Name: 'Immediate' }, Address: { Locality: 'Parramatta' } }),
      job('Complete', { Type: 'Storm', JobPriorityType: { Name: 'Immediate' }, Address: { Locality: null } }),
      job('Complete', { JobPriorityType: { Name: 'General' }, Address: {} }),
    ]);
    expect(s.jobTypes).toEqual([{ label: 'Flood Support', count: 1 }, { label: 'N/A', count: 1 }, { label: 'Storm', count: 1 }]);
    expect(s.priorities).toEqual([{ label: 'Immediate', count: 2 }, { label: 'General', count: 1 }]);
    expect(s.localities).toEqual([{ label: 'N/A', count: 2 }, { label: 'Parramatta', count: 1 }]);
    expect(s.received).toBe(3);
  });
});

describe('formatDuration', () => {
  it('formats days/hours/minutes', () => {
    expect(formatDuration(20 * 1000)).toBe('<1 min');
    expect(formatDuration(45 * 60000)).toBe('45 min');
    expect(formatDuration(125 * 60000)).toBe('2 hr 5 min');
    expect(formatDuration((24 * 60 + 180) * 60000)).toBe('1 day 3 hr');
  });
});
