import { describe, it, expect } from 'vitest';
import { resolveReminderTime } from './reminderPresets.js';

const now = new Date('2026-01-01T12:00:00.000Z');

describe('resolveReminderTime', () => {
  it('returns null for "none"', () => {
    expect(resolveReminderTime('none', now)).toBeNull();
  });

  it('adds 30/60/120 minutes to now for the fixed presets', () => {
    expect(resolveReminderTime('30', now).toISOString()).toBe('2026-01-01T12:30:00.000Z');
    expect(resolveReminderTime('60', now).toISOString()).toBe('2026-01-01T13:00:00.000Z');
    expect(resolveReminderTime('120', now).toISOString()).toBe('2026-01-01T14:00:00.000Z');
  });

  it('uses the given custom date for "custom"', () => {
    const custom = new Date('2026-01-02T09:00:00.000Z');
    expect(resolveReminderTime('custom', now, custom)).toBe(custom);
  });

  it('returns null for "custom" with no custom date given', () => {
    expect(resolveReminderTime('custom', now, null)).toBeNull();
  });

  it('returns null for an unknown preset key', () => {
    expect(resolveReminderTime('bogus', now)).toBeNull();
  });
});
