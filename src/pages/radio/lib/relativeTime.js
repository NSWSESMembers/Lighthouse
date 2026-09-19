/*
  Pure "N minutes ago" formatter for the console's absolute/relative time
  display toggle (Settings). Kept dependency-free rather than pulling in
  moment for one string -- OpsLogEntry.js already has its own moment-based
  timeLoggedAgo for table rows; this is only for view-model-level timestamps
  (e.g. "Last refresh") that aren't already an OpsLogEntry.
*/

const UNITS = [
  { limit: 60, divisor: 1, singular: 'second' },
  { limit: 3600, divisor: 60, singular: 'minute' },
  { limit: 86400, divisor: 3600, singular: 'hour' },
  { limit: 604800, divisor: 86400, singular: 'day' },
];

/**
 * @param {Date|null} date
 * @param {number} [nowMs]
 * @returns {string}
 */
export function relativeTimeFromNow(date, nowMs = Date.now()) {
  if (!date) return 'never';
  const diffSeconds = Math.max(0, Math.round((nowMs - date.getTime()) / 1000));
  if (diffSeconds < 5) return 'just now';

  for (const unit of UNITS) {
    if (diffSeconds < unit.limit) {
      const value = Math.floor(diffSeconds / unit.divisor);
      return `${value} ${unit.singular}${value === 1 ? '' : 's'} ago`;
    }
  }
  const weeks = Math.floor(diffSeconds / 604800);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}
