import { describe, it, expect } from 'vitest';
import { isReminderDue, isReminderDueSoon, classifyReminderSeverity, DUE_SOON_WINDOW_MS } from './reminders.js';

const now = new Date('2026-01-01T12:00:00.000Z').getTime();

describe('isReminderDue', () => {
  it('is due when the reminder time has passed and action is still required', () => {
    expect(isReminderDue({ actionReminder: '2026-01-01T11:00:00.000Z', actionRequired: true }, now)).toBe(true);
  });

  it('is due exactly at the reminder instant (inclusive)', () => {
    expect(isReminderDue({ actionReminder: '2026-01-01T12:00:00.000Z', actionRequired: true }, now)).toBe(true);
  });

  it('is not due before the reminder time', () => {
    expect(isReminderDue({ actionReminder: '2026-01-01T13:00:00.000Z', actionRequired: true }, now)).toBe(false);
  });

  it('is not due when there is no reminder set', () => {
    expect(isReminderDue({ actionReminder: null, actionRequired: true }, now)).toBe(false);
  });

  it('is not due once actionRequired has been cleared (resolved)', () => {
    expect(isReminderDue({ actionReminder: '2026-01-01T11:00:00.000Z', actionRequired: false }, now)).toBe(false);
  });

  it('is not due for an unparseable reminder value', () => {
    expect(isReminderDue({ actionReminder: 'not-a-date', actionRequired: true }, now)).toBe(false);
  });
});

describe('isReminderDueSoon', () => {
  it('is due soon when the reminder falls within the window', () => {
    const reminder = new Date(now + DUE_SOON_WINDOW_MS - 1000).toISOString();
    expect(isReminderDueSoon({ actionReminder: reminder, actionRequired: true }, now)).toBe(true);
  });

  it('is due soon exactly at the edge of the window (inclusive)', () => {
    const reminder = new Date(now + DUE_SOON_WINDOW_MS).toISOString();
    expect(isReminderDueSoon({ actionReminder: reminder, actionRequired: true }, now)).toBe(true);
  });

  it('is not due soon when the reminder is further out than the window', () => {
    const reminder = new Date(now + DUE_SOON_WINDOW_MS + 1000).toISOString();
    expect(isReminderDueSoon({ actionReminder: reminder, actionRequired: true }, now)).toBe(false);
  });

  it('is due soon (already overdue counts) when the reminder has already passed', () => {
    expect(isReminderDueSoon({ actionReminder: '2026-01-01T11:00:00.000Z', actionRequired: true }, now)).toBe(true);
  });

  it('is not due soon when there is no reminder set', () => {
    expect(isReminderDueSoon({ actionReminder: null, actionRequired: true }, now)).toBe(false);
  });

  it('is not due soon once actionRequired has been cleared (resolved)', () => {
    expect(isReminderDueSoon({ actionReminder: '2026-01-01T12:05:00.000Z', actionRequired: false }, now)).toBe(false);
  });

  it('is not due soon for an unparseable reminder value', () => {
    expect(isReminderDueSoon({ actionReminder: 'not-a-date', actionRequired: true }, now)).toBe(false);
  });

  it('respects a custom window', () => {
    const reminder = new Date(now + 5 * 60000).toISOString();
    expect(isReminderDueSoon({ actionReminder: reminder, actionRequired: true }, now, 10 * 60000)).toBe(true);
    expect(isReminderDueSoon({ actionReminder: reminder, actionRequired: true }, now, 1 * 60000)).toBe(false);
  });
});

describe('classifyReminderSeverity', () => {
  it('is "overdue" once the reminder has passed', () => {
    expect(classifyReminderSeverity({ actionReminder: '2026-01-01T11:00:00.000Z', actionRequired: true }, now)).toBe('overdue');
  });

  it('is "due-soon" within the window but not yet overdue', () => {
    const reminder = new Date(now + 5 * 60000).toISOString();
    expect(classifyReminderSeverity({ actionReminder: reminder, actionRequired: true }, now)).toBe('due-soon');
  });

  it('is "not-due" when the reminder is further out than the window', () => {
    const reminder = new Date(now + DUE_SOON_WINDOW_MS + 1000).toISOString();
    expect(classifyReminderSeverity({ actionReminder: reminder, actionRequired: true }, now)).toBe('not-due');
  });

  it('is "not-due" when there is no reminder set at all', () => {
    expect(classifyReminderSeverity({ actionReminder: null, actionRequired: true }, now)).toBe('not-due');
  });

  it('respects a custom window', () => {
    const reminder = new Date(now + 5 * 60000).toISOString();
    expect(classifyReminderSeverity({ actionReminder: reminder, actionRequired: true }, now, 10 * 60000)).toBe('due-soon');
    expect(classifyReminderSeverity({ actionReminder: reminder, actionRequired: true }, now, 1 * 60000)).toBe('not-due');
  });
});
