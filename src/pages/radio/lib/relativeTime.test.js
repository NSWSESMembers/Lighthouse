import { describe, it, expect } from 'vitest';
import { relativeTimeFromNow } from './relativeTime.js';

const now = new Date('2026-01-01T12:00:00.000Z').getTime();

describe('relativeTimeFromNow', () => {
  it('returns "never" for no date', () => {
    expect(relativeTimeFromNow(null, now)).toBe('never');
  });

  it('returns "just now" for under 5 seconds', () => {
    expect(relativeTimeFromNow(new Date(now - 2000), now)).toBe('just now');
  });

  it('formats seconds', () => {
    expect(relativeTimeFromNow(new Date(now - 30000), now)).toBe('30 seconds ago');
  });

  it('formats minutes, singular and plural', () => {
    expect(relativeTimeFromNow(new Date(now - 60000), now)).toBe('1 minute ago');
    expect(relativeTimeFromNow(new Date(now - 5 * 60000), now)).toBe('5 minutes ago');
  });

  it('formats hours', () => {
    expect(relativeTimeFromNow(new Date(now - 2 * 3600000), now)).toBe('2 hours ago');
  });

  it('formats days', () => {
    expect(relativeTimeFromNow(new Date(now - 2 * 86400000), now)).toBe('2 days ago');
  });

  it('formats weeks for anything a week or older', () => {
    expect(relativeTimeFromNow(new Date(now - 10 * 86400000), now)).toBe('1 week ago');
  });

  it('treats a future date as "just now" rather than a negative duration', () => {
    expect(relativeTimeFromNow(new Date(now + 5000), now)).toBe('just now');
  });
});
