import { describe, it, expect } from 'vitest';
import { formatLogRowTime } from './logRowTime.js';

const now = new Date('2026-09-18T02:33:45.000Z').getTime(); // arbitrary fixed instant

describe('formatLogRowTime', () => {
  it('returns a dash placeholder with no reminder/logged time', () => {
    expect(formatLogRowTime(null, 'relative', now)).toEqual({ primary: '-', title: '' });
  });

  it('returns a dash placeholder for an unparseable value', () => {
    expect(formatLogRowTime('not-a-date', 'absolute', now)).toEqual({ primary: '-', title: '' });
  });

  it('relative mode: primary is "N ago", title is always the full absolute date/time', () => {
    const loggedAt = new Date(now - 5 * 60000).toISOString(); // 5 minutes before `now`
    const result = formatLogRowTime(loggedAt, 'relative', now);
    expect(result.primary).toBe('5 minutes ago');
    expect(result.title).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  });

  // built from local dates (the formatter works in local time), so these hold in any time zone
  const localNow = new Date(2026, 8, 18, 15, 0, 0).getTime();
  const at = (y, m, d, h, min, sec = 0) => new Date(y, m - 1, d, h, min, sec).toISOString();

  it('absolute mode, today: HH:mm with no seconds and no date', () => {
    expect(formatLogRowTime(at(2026, 9, 18, 9, 5, 9), 'absolute', localNow).primary).toBe('09:05');
  });

  it('absolute mode, yesterday: the short date is shown too -- DD/MM HH:mm', () => {
    expect(formatLogRowTime(at(2026, 9, 17, 21, 36, 40), 'absolute', localNow).primary).toBe('17/09 21:36');
  });

  it('absolute mode, earlier days: also DD/MM HH:mm; a new year is not confused with today', () => {
    expect(formatLogRowTime(at(2026, 9, 10, 8, 0), 'absolute', localNow).primary).toBe('10/09 08:00');
    expect(formatLogRowTime(at(2025, 9, 18, 15, 0), 'absolute', localNow).primary).toBe('18/09 15:00');
  });

  it('absolute mode: just after local midnight, 23:59 the day before is yesterday, 00:01 today is not', () => {
    const justAfterMidnight = new Date(2026, 8, 18, 0, 30).getTime();
    expect(formatLogRowTime(at(2026, 9, 17, 23, 59), 'absolute', justAfterMidnight).primary).toBe('17/09 23:59');
    expect(formatLogRowTime(at(2026, 9, 18, 0, 1), 'absolute', justAfterMidnight).primary).toBe('00:01');
  });

  it('relative mode is unaffected by the day', () => {
    expect(formatLogRowTime(at(2026, 9, 17, 14, 0), 'relative', localNow).primary).toMatch(/ago$/);
  });

  it('title always carries the full date and seconds-level precision, independent of mode', () => {
    const loggedAt = new Date('2026-09-18T02:30:12.000Z');
    const relative = formatLogRowTime(loggedAt.toISOString(), 'relative', now);
    const absolute = formatLogRowTime(loggedAt.toISOString(), 'absolute', now);
    expect(relative.title).toBe(absolute.title);
    expect(relative.title.endsWith(':12')).toBe(true);
  });
});
