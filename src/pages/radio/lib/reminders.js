/*
  Pure "is this entry's reminder due" check, operating on plain field values
  (not Knockout observables) so it's testable without a view model. The
  Radio Console re-evaluates this against every currently-loaded entry on a
  timer, since a reminder can become due purely from time passing, with no
  new data arriving to trigger a recompute otherwise.
*/

/**
 * @param {{actionReminder: string|null, actionRequired: boolean}} entry
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isReminderDue({ actionReminder, actionRequired }, nowMs = Date.now()) {
  if (!actionRequired) return false; // already resolved/cleared -- nothing due
  if (!actionReminder) return false;
  const dueAt = new Date(actionReminder).getTime();
  return !isNaN(dueAt) && dueAt <= nowMs;
}

// How far ahead of its reminder time an entry counts as "due soon" for the
// outstanding-actions panel (RadioConsoleViewModel.js) -- an entry with no
// reminder at all, or one whose reminder is further out than this, doesn't
// belong in that panel yet even though ActionRequired is still set. This is
// the fallback default; the console's own Settings control lets an operator
// pick one of DUE_SOON_WINDOW_OPTIONS instead (persisted -- see
// RadioConsoleViewModel.js).
export const DUE_SOON_WINDOW_MS = 15 * 60 * 1000;

// Settings control options -- 3h/2h/1h/15m/5m, per operator preference for
// how far ahead of due time an outstanding action should start surfacing.
export const DUE_SOON_WINDOW_OPTIONS = [
  { minutes: 180, label: '3 hours' },
  { minutes: 120, label: '2 hours' },
  { minutes: 60, label: '1 hour' },
  { minutes: 15, label: '15 minutes' },
  { minutes: 5, label: '5 minutes' },
];

/**
 * True once a reminder is within `windowMs` of firing -- inclusive of
 * already-overdue reminders (isReminderDue's due-at-or-past-now case is a
 * subset of this).
 *
 * @param {{actionReminder: string|null, actionRequired: boolean}} entry
 * @param {number} [nowMs]
 * @param {number} [windowMs]
 * @returns {boolean}
 */
export function isReminderDueSoon({ actionReminder, actionRequired }, nowMs = Date.now(), windowMs = DUE_SOON_WINDOW_MS) {
  if (!actionRequired) return false;
  if (!actionReminder) return false;
  const dueAt = new Date(actionReminder).getTime();
  return !isNaN(dueAt) && dueAt <= nowMs + windowMs;
}

/**
 * Urgency tier for the Outstanding Actions panel's card colour -- every
 * ActionRequired entry gets one of these (unlike isReminderDueSoon, which
 * decides whether an entry belongs in the panel *at all*): a distant or
 * missing reminder is "not-due" rather than excluded, so the entry still
 * shows, just with the least urgent styling.
 *
 * @param {{actionReminder: string|null, actionRequired: boolean}} entry
 * @param {number} [nowMs]
 * @param {number} [windowMs]
 * @returns {'overdue'|'due-soon'|'not-due'}
 */
export function classifyReminderSeverity(entry, nowMs = Date.now(), windowMs = DUE_SOON_WINDOW_MS) {
  if (isReminderDue(entry, nowMs)) return 'overdue';
  if (isReminderDueSoon(entry, nowMs, windowMs)) return 'due-soon';
  return 'not-due';
}
