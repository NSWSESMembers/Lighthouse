import { describe, it, expect } from 'vitest';
import { formatRelativeDue } from './relativeDueTime.js';

const now = new Date('2026-01-01T12:00:00.000Z').getTime();

describe('formatRelativeDue', () => {
  it('returns "" for no due time', () => {
    expect(formatRelativeDue(null, now)).toBe('');
  });

  it('returns "" for an unparseable value', () => {
    expect(formatRelativeDue('not-a-date', now)).toBe('');
  });

  it('returns "now" within 5 seconds either side', () => {
    expect(formatRelativeDue(new Date(now + 2000).toISOString(), now)).toBe('now');
    expect(formatRelativeDue(new Date(now - 2000).toISOString(), now)).toBe('now');
  });

  it('describes a future due time as "in N minutes"', () => {
    expect(formatRelativeDue(new Date(now + 5 * 60000).toISOString(), now)).toBe('in 5 minutes');
  });

  it('describes a past due time as "N minutes ago"', () => {
    expect(formatRelativeDue(new Date(now - 5 * 60000).toISOString(), now)).toBe('5 minutes ago');
  });

  it('handles singular units in both directions', () => {
    expect(formatRelativeDue(new Date(now + 60000).toISOString(), now)).toBe('in 1 minute');
    expect(formatRelativeDue(new Date(now - 60000).toISOString(), now)).toBe('1 minute ago');
  });

  it('formats hours and days', () => {
    expect(formatRelativeDue(new Date(now + 2 * 3600000).toISOString(), now)).toBe('in 2 hours');
    expect(formatRelativeDue(new Date(now - 2 * 86400000).toISOString(), now)).toBe('2 days ago');
  });

  it('formats weeks for anything a week or older/further out', () => {
    expect(formatRelativeDue(new Date(now - 10 * 86400000).toISOString(), now)).toBe('1 week ago');
    expect(formatRelativeDue(new Date(now + 10 * 86400000).toISOString(), now)).toBe('in 1 week');
  });
});
