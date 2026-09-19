import { describe, it, expect } from 'vitest';
import { filterIncidentsReceivedInWindow, applyIncidentFilters } from './incidentMetrics.js';

const windowStart = new Date('2026-01-01T00:00:00.000Z');
const windowEnd = new Date('2026-01-02T00:00:00.000Z');
const job = (JobReceived, extra = {}) => ({ Id: JobReceived, JobReceived, ...extra });

describe('filterIncidentsReceivedInWindow', () => {
  it('includes a job received exactly at windowStart (inclusive)', () => {
    const result = filterIncidentsReceivedInWindow([job(windowStart.toISOString())], windowStart, windowEnd);
    expect(result).toHaveLength(1);
  });

  it('excludes a job received exactly at windowEnd (exclusive)', () => {
    const result = filterIncidentsReceivedInWindow([job(windowEnd.toISOString())], windowStart, windowEnd);
    expect(result).toHaveLength(0);
  });

  it('excludes jobs outside the window', () => {
    const result = filterIncidentsReceivedInWindow(
      [job('2025-12-31T23:59:59.999Z'), job('2026-01-02T00:00:00.001Z')],
      windowStart,
      windowEnd,
    );
    expect(result).toHaveLength(0);
  });

  it('includes jobs strictly inside the window', () => {
    const result = filterIncidentsReceivedInWindow([job('2026-01-01T12:00:00.000Z')], windowStart, windowEnd);
    expect(result).toHaveLength(1);
  });
});

describe('applyIncidentFilters', () => {
  it('filters by sector when requested', () => {
    const jobs = [job('a', { Sector: { Id: 1 } }), job('b', { Sector: { Id: 2 } })];
    expect(applyIncidentFilters(jobs, { sectorId: 1 })).toHaveLength(1);
  });

  it('filters by event when requested', () => {
    const jobs = [job('a', { Event: { Id: 'E1' } }), job('b', { Event: { Id: 'E2' } })];
    expect(applyIncidentFilters(jobs, { eventId: 'E2' })).toHaveLength(1);
  });

  it('keeps jobs with no sector/event assigned when no filter is requested', () => {
    const jobs = [job('a'), job('b', { Sector: { Id: 1 } })];
    expect(applyIncidentFilters(jobs, {})).toHaveLength(2);
  });

  it('excludes a job with no sector when a sector filter is requested', () => {
    const jobs = [job('a'), job('b', { Sector: { Id: 1 } })];
    expect(applyIncidentFilters(jobs, { sectorId: 1 })).toHaveLength(1);
  });
});
