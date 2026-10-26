/*
  Page parameters for the stats page.

  Beacon's Lighthouse menu and the Jobs screen's "Statistics (Filtered)"
  button open pages/stats.html with:
    ?host=<Beacon API base>&source=<Beacon origin>&userId=..&hq=<id[,id..]>
     &start=<ISO>&end=<ISO>
  `hq` is absent (or empty) for "all of NSW".
*/

/**
 * @param {string} search  location.search, with or without the leading "?"
 * @returns {{host: string, source: string, userId: string, hqIds: string[], start: Date, end: Date}}
 */
export function parseStatsParams(search) {
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
    start: new Date(p.get('start')),
    end: new Date(p.get('end')),
  };
}

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

/**
 * Heading for the page: which units the statistics cover.
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
