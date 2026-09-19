/*
  Quick reporting-period choices: "Last N" ending now, or "As Per Event"
  taking the chosen event's own dates.
*/

export const PERIOD_PRESETS = [
  { key: '6h', label: 'Last 6 Hrs', minutes: 6 * 60 },
  { key: '12h', label: 'Last 12 Hrs', minutes: 12 * 60 },
  { key: '1d', label: 'Last 1 Day', minutes: 24 * 60 },
  { key: '7d', label: 'Last 7 Days', minutes: 7 * 24 * 60 },
  { key: '30d', label: 'Last 30 Days', minutes: 30 * 24 * 60 },
  { key: 'event', label: 'As Per Event', minutes: null },
];

/**
 * @param {Date} now
 * @param {number} minutes
 * @returns {{start: Date, end: Date}}
 */
export function lastNMinutes(now, minutes) {
  return { start: new Date(now.getTime() - minutes * 60000), end: now };
}

// Beacon's event records aren't documented for their date fields here, so a few
// plausible names are tried -- when none is present the caller says so rather than guessing.
const START_FIELDS = ['StartDate', 'EventStartDate', 'StartTime', 'Start', 'DateFrom'];
const END_FIELDS = ['EndDate', 'EventEndDate', 'EndTime', 'End', 'DateTo'];

function firstDate(record, fields) {
  for (const f of fields) {
    if (record?.[f]) {
      const d = new Date(record[f]);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/**
 * The event's own period: its start and (if it has ended) its end, else now.
 *
 * @param {object|null} event  a Beacon event record
 * @param {Date} now
 * @returns {{start: Date, end: Date}|null}  null when the event carries no start date
 */
export function eventRange(event, now) {
  const start = firstDate(event, START_FIELDS);
  if (!start) return null;
  const end = firstDate(event, END_FIELDS);
  return { start, end: end && end.getTime() > start.getTime() && end.getTime() < now.getTime() ? end : now };
}
