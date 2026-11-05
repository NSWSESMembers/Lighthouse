/*
  Page parameters for the Lighthouse pages Beacon opens in a new tab
  (Incident Statistics, Incident Summary, Incident Export, NITC Export).

  Beacon's Lighthouse menu and the Jobs screen's "(Filtered)" buttons open
  them with:
    ?host=<Beacon API base>&source=<Beacon origin>&userId=..&hq=<id[,id..]>
     &start=<ISO>&end=<ISO>
  `hq` is absent (or empty) for "all of NSW".
*/

/**
 * A date param, or an invalid Date when it's missing. Not new Date(null):
 * that's 1 January 1970, which would pass isValidRange and have the page
 * search Beacon's whole incident history.
 */
function dateParam(value) {
  return value ? new Date(value) : new Date(NaN);
}

/**
 * @param {string} search  location.search, with or without the leading "?"
 * @returns {{host: string, source: string, userId: string, hqIds: string[], start: Date, end: Date}}
 */
export function parsePageParams(search) {
  const p = new URLSearchParams(search);
  const hqIds = (p.get('hq') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    host: p.get('host') || '',
    source: p.get('source') || '',
    userId: p.get('userId') || 'notPassed',
    hqIds,
    start: dateParam(p.get('start')),
    end: dateParam(p.get('end')),
  };
}

/** The toolbar's time range buttons; `value` is what rangeForChoice takes. */
export const RANGE_CHOICES = [
  { value: 'launch', id: 'range-launch', label: 'As opened' },
  { value: '24', id: 'range-24', label: 'Last 24 h' },
  { value: '48', id: 'range-48', label: '48 h' },
  { value: '72', id: 'range-72', label: '72 h' },
  { value: '168', id: 'range-168', label: '7 days' },
];

/**
 * The window to load: the launch range, or the last `hours` hours to now.
 *
 * @param {{start: Date, end: Date}} launchRange
 * @param {string} choice  'launch' or a number of hours ('24', '48', ...)
 * @param {Date} now
 * @returns {{start: Date, end: Date}}
 */
export function rangeForChoice(launchRange, choice, now = new Date()) {
  const hours = Number(choice);
  if (choice === 'launch' || !Number.isFinite(hours) || hours <= 0) {
    return { start: launchRange.start, end: launchRange.end };
  }
  return { start: new Date(now.getTime() - hours * 3600 * 1000), end: now };
}

/** True when both ends are real dates and start is before end. */
export function isValidRange({ start, end }) {
  return start instanceof Date && end instanceof Date
    && !isNaN(start) && !isNaN(end) && start < end;
}

const RANGE_FMT = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** "Thu 15 Oct 2026, 00:00 to Thu 15 Oct 2026, 23:59" for the header. */
export function rangeText(range) {
  return isValidRange(range)
    ? `${RANGE_FMT.format(range.start)} to ${RANGE_FMT.format(range.end)}`
    : 'No valid date range';
}

/**
 * Heading for the page: which units it covers.
 *
 * @param {Array<{Name: string, ParentEntity?: {Code: string}}>} units  [] for all of NSW
 * @returns {string}
 */
export function scopeTitle(units) {
  if (!units.length) return 'NSW';
  if (units.length === 1) return units[0].Name;
  const parents = new Set(units.map((u) => u.ParentEntity?.Code).filter(Boolean));
  if (parents.size === 1) return `${units.length} ${[...parents][0]} units`;
  return `${units.length} units`;
}

const ENVIRONMENTS = {
  'https://trainbeacon.ses.nsw.gov.au': 'trainbeacon',
  'https://devbeacon.ses.nsw.gov.au': 'devbeacon',
};

/**
 * Which Beacon the page was opened from, for the header colour (same
 * colours as LAD: orange for production, green for train, blue for dev).
 *
 * @param {string} source  the Beacon origin (the `source` param)
 * @returns {'production'|'trainbeacon'|'devbeacon'}
 */
export function beaconEnvironment(source) {
  return ENVIRONMENTS[String(source || '').replace(/\/+$/, '')] || 'production';
}
