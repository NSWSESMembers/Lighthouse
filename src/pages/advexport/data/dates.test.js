import { describe, it, expect } from 'vitest';
import { isoDateTime, fileStamp } from './dates.js';

describe('isoDateTime', () => {
  it('adds Sydney daylight time (+11:00) in summer', () => {
    expect(isoDateTime('2026-10-27T10:00:00')).toBe('2026-10-27T10:00:00+11:00');
  });

  it('adds standard time (+10:00) in winter', () => {
    expect(isoDateTime('2026-07-01T23:59:59')).toBe('2026-07-01T23:59:59+10:00');
  });

  it('gets the offset right either side of the changeovers', () => {
    // Daylight saving starts 2:00 Sun 4 Oct 2026 and ends 3:00 Sun 5 Apr 2026.
    expect(isoDateTime('2026-10-04T01:30:00')).toBe('2026-10-04T01:30:00+10:00');
    expect(isoDateTime('2026-10-04T03:30:00')).toBe('2026-10-04T03:30:00+11:00');
    expect(isoDateTime('2026-04-05T01:30:00')).toBe('2026-04-05T01:30:00+11:00');
    expect(isoDateTime('2026-04-05T04:00:00')).toBe('2026-04-05T04:00:00+10:00');
  });

  it('drops fractions of a second and fills in missing seconds', () => {
    expect(isoDateTime('2026-10-27T10:00:05.123')).toBe('2026-10-27T10:00:05+11:00');
    expect(isoDateTime('2026-10-27T10:00')).toBe('2026-10-27T10:00:00+11:00');
  });

  it('turns a time that already has an offset into Sydney time', () => {
    expect(isoDateTime('2026-10-26T23:00:00Z')).toBe('2026-10-27T10:00:00+11:00');
  });

  it('is empty for no time or an unreadable one', () => {
    expect(isoDateTime(null)).toBe('');
    expect(isoDateTime(undefined)).toBe('');
    expect(isoDateTime('')).toBe('');
    expect(isoDateTime('soon')).toBe('');
  });
});

describe('fileStamp', () => {
  it('is Sydney date and time', () => {
    expect(fileStamp(new Date('2026-10-26T23:15:00Z'))).toBe('2026-10-27 1015');
  });
});
