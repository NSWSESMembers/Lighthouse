import { describe, it, expect } from 'vitest';
import { sydneyWallTimeToUtc, parseSydneyDateTimeLocal, formatSydney, sydneyOffsetMinutes, formatSydneyDateTimeLocal, formatReportingPeriod, formatSydneyHrs } from './sydneyTime.js';

describe('sydneyOffsetMinutes', () => {
  it('is +600 (AEST) in the middle of winter', () => {
    expect(sydneyOffsetMinutes(new Date('2026-07-01T00:00:00.000Z'))).toBe(600);
  });

  it('is +660 (AEDT) in the middle of summer', () => {
    expect(sydneyOffsetMinutes(new Date('2026-01-01T00:00:00.000Z'))).toBe(660);
  });
});

describe('sydneyWallTimeToUtc', () => {
  it('converts a standard-time (AEST, UTC+10) wall-clock instant', () => {
    // 17 Sep 2026 14:00 Sydney (AEST, well outside DST) = 04:00 UTC
    const utc = sydneyWallTimeToUtc({ year: 2026, month: 9, day: 17, hour: 14, minute: 0 });
    expect(utc.toISOString()).toBe('2026-09-17T04:00:00.000Z');
  });

  it('converts a daylight-time (AEDT, UTC+11) wall-clock instant', () => {
    // 17 Jan 2026 14:00 Sydney (AEDT) = 03:00 UTC
    const utc = sydneyWallTimeToUtc({ year: 2026, month: 1, day: 17, hour: 14, minute: 0 });
    expect(utc.toISOString()).toBe('2026-01-17T03:00:00.000Z');
  });

  it('handles the DST-start boundary (AEST -> AEDT, first Sunday of October 2026)', () => {
    // clocks jump 02:00 -> 03:00 on 4 Oct 2026; 01:30 is still AEST (+10)
    const beforeJump = sydneyWallTimeToUtc({ year: 2026, month: 10, day: 4, hour: 1, minute: 30 });
    expect(beforeJump.toISOString()).toBe('2026-10-03T15:30:00.000Z');

    // 03:30 (after the jump) is AEDT (+11)
    const afterJump = sydneyWallTimeToUtc({ year: 2026, month: 10, day: 4, hour: 3, minute: 30 });
    expect(afterJump.toISOString()).toBe('2026-10-03T16:30:00.000Z');
  });

  it('handles the DST-end boundary (AEDT -> AEST, first Sunday of April 2026)', () => {
    // clocks fall back 03:00 -> 02:00 on 5 Apr 2026; 01:30 (first, AEDT) occurrence
    const wallTime = sydneyWallTimeToUtc({ year: 2026, month: 4, day: 5, hour: 1, minute: 30 });
    // 01:30 AEDT (+11) => 14:30 UTC the prior day
    expect(wallTime.toISOString()).toBe('2026-04-04T14:30:00.000Z');
  });
});

describe('parseSydneyDateTimeLocal', () => {
  it('parses a datetime-local value as Sydney time', () => {
    const utc = parseSydneyDateTimeLocal('2026-09-17T14:00');
    expect(utc.toISOString()).toBe('2026-09-17T04:00:00.000Z');
  });

  it('returns null for malformed or empty input', () => {
    expect(parseSydneyDateTimeLocal('')).toBeNull();
    expect(parseSydneyDateTimeLocal(undefined)).toBeNull();
    expect(parseSydneyDateTimeLocal('not-a-date')).toBeNull();
  });
});

describe('formatSydney', () => {
  it('formats a UTC instant as Sydney local display text', () => {
    const formatted = formatSydney(new Date('2026-09-17T04:00:00.000Z'));
    expect(formatted).toContain('17/09/2026');
    expect(formatted).toContain('14:00');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatSydney(new Date('not-a-date'))).toBe('');
  });
});

describe('formatSydneyDateTimeLocal', () => {
  it('round-trips with parseSydneyDateTimeLocal across AEST and AEDT', () => {
    ['2026-01-15T09:30', '2026-07-15T09:30', '2026-10-04T01:59', '2026-10-04T03:00'].forEach((v) => {
      expect(formatSydneyDateTimeLocal(parseSydneyDateTimeLocal(v))).toBe(v);
    });
  });
  it('is empty for an invalid date', () => {
    expect(formatSydneyDateTimeLocal(new Date('nope'))).toBe('');
  });
});

describe('formatReportingPeriod', () => {
  it('is dd/mm/yyyy HH:MM to dd/mm/yyyy HH:MM with the zone once at the end', () => {
    const start = parseSydneyDateTimeLocal('2026-09-19T08:00');
    const end = parseSydneyDateTimeLocal('2026-09-19T20:05');
    expect(formatReportingPeriod(start, end)).toBe('19/09/2026 08:00 to 19/09/2026 20:05 AEST');
  });
  it('uses the daylight-saving abbreviation in summer', () => {
    expect(formatReportingPeriod(parseSydneyDateTimeLocal('2026-01-15T08:00'), parseSydneyDateTimeLocal('2026-01-15T20:00'))).toBe('15/01/2026 08:00 to 15/01/2026 20:00 AEDT');
  });
  it('shows each zone when the period crosses the changeover', () => {
    expect(formatReportingPeriod(parseSydneyDateTimeLocal('2026-10-03T12:00'), parseSydneyDateTimeLocal('2026-10-04T12:00'))).toBe('03/10/2026 12:00 AEST to 04/10/2026 12:00 AEDT');
  });
});

describe('formatSydneyHrs', () => {
  it('is dd/mm/yyyy HH:MMhrs in Sydney time', () => {
    expect(formatSydneyHrs(parseSydneyDateTimeLocal('2026-09-19T14:37'))).toBe('19/09/2026 14:37hrs');
    expect(formatSydneyHrs(parseSydneyDateTimeLocal('2026-01-05T00:05'))).toBe('05/01/2026 00:05hrs');
    expect(formatSydneyHrs(new Date('nope'))).toBe('');
  });
});
