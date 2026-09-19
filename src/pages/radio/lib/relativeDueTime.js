/*
  Pure bidirectional "in N minutes" / "N minutes ago" formatter for a
  reminder's due time. Deliberately separate from relativeTime.js's
  relativeTimeFromNow(), which clamps any future date to "just now" -- that
  is the right behaviour for a "Last refresh" timestamp (a future refresh
  time is only ever clock skew, never real), but wrong here: an outstanding
  action's reminder is very often still in the future (this only ever
  renders for entries isReminderDueSoon() already let through, so "in 8
  minutes" is a normal, expected value, not an anomaly to hide).
*/

const UNITS = [
  { limit: 60, divisor: 1, singular: 'second' },
  { limit: 3600, divisor: 60, singular: 'minute' },
  { limit: 86400, divisor: 3600, singular: 'hour' },
  { limit: 604800, divisor: 86400, singular: 'day' },
];

/**
 * @param {string|null} isoDue
 * @param {number} [nowMs]
 * @returns {string}  '' when there is no due time to describe
 */
export function formatRelativeDue(isoDue, nowMs = Date.now()) {
  if (!isoDue) return '';
  const date = new Date(isoDue);
  if (isNaN(date.getTime())) return '';

  const diffMs = date.getTime() - nowMs; // positive = still ahead, negative = overdue
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  if (absSeconds < 5) return 'now'; // e.g. rendered by the caller as "Due now"

  const describe = (value, singular) => `${value} ${singular}${value === 1 ? '' : 's'}`;

  for (const unit of UNITS) {
    if (absSeconds < unit.limit) {
      const label = describe(Math.floor(absSeconds / unit.divisor), unit.singular);
      return diffMs > 0 ? `in ${label}` : `${label} ago`;
    }
  }
  const label = describe(Math.floor(absSeconds / 604800), 'week');
  return diffMs > 0 ? `in ${label}` : `${label} ago`;
}
