/*
  Australia/Sydney wall-clock <-> UTC-instant conversion, dependency-free
  (no moment-timezone in this repo). Uses Intl.DateTimeFormat as the source
  of truth for the zone's offset at a given instant, so DST transitions
  (first Sunday of October / first Sunday of April) are handled correctly
  without hardcoding transition dates.
*/

const SYDNEY_TZ = 'Australia/Sydney';

const offsetFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SYDNEY_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * The Sydney UTC offset, in minutes, at the given instant (positive = ahead of UTC).
 *
 * @param {Date} utcInstant
 * @returns {number}
 */
export function sydneyOffsetMinutes(utcInstant) {
  const parts = offsetFormatter.formatToParts(utcInstant).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - utcInstant.getTime()) / 60000);
}

/**
 * Interpret Sydney wall-clock date/time components (e.g. from a
 * `<input type="datetime-local">`, which is always "YYYY-MM-DDTHH:mm" with
 * no timezone of its own) as Australia/Sydney local time, and return the
 * corresponding UTC instant.
 *
 * Not meaningful for the skipped hour at the start of DST (early October) --
 * that wall-clock time never occurs in Sydney. The repeated hour at the end
 * of DST (early April) resolves to its first (daylight) occurrence.
 *
 * @param {{year: number, month: number, day: number, hour: number, minute: number}} components  month is 1-12
 * @returns {Date}
 */
export function sydneyWallTimeToUtc({ year, month, day, hour, minute }) {
  const naiveUtcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Two passes converge even right at a DST boundary, since the offset can
  // only change once between the naive guess and the corrected instant.
  let instantMs = naiveUtcGuess;
  for (let i = 0; i < 2; i++) {
    const offset = sydneyOffsetMinutes(new Date(instantMs));
    instantMs = naiveUtcGuess - offset * 60000;
  }
  return new Date(instantMs);
}

/**
 * Parse a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") as
 * Sydney local time and return the UTC instant, or null if malformed/empty.
 *
 * @param {string} value
 * @returns {Date|null}
 */
export function parseSydneyDateTimeLocal(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return sydneyWallTimeToUtc({ year, month, day, hour, minute });
}

/**
 * Format a UTC instant as a Sydney wall-clock display string, e.g.
 * "17/09/2026 14:05 AEST".
 *
 * @param {Date} utcInstant
 * @returns {string}
 */
export function formatSydney(utcInstant) {
  if (!(utcInstant instanceof Date) || isNaN(utcInstant.getTime())) return '';
  const datePart = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(utcInstant);
  const zoneAbbrev = new Intl.DateTimeFormat('en-AU', {
    timeZone: SYDNEY_TZ,
    timeZoneName: 'short',
  })
    .formatToParts(utcInstant)
    .find((p) => p.type === 'timeZoneName')?.value;
  return zoneAbbrev ? `${datePart} ${zoneAbbrev}` : datePart;
}

/**
 * The inverse of parseSydneyDateTimeLocal: a UTC instant as the Sydney
 * wall-clock value a `<input type="datetime-local">` takes ("YYYY-MM-DDTHH:mm").
 *
 * @param {Date} utcInstant
 * @returns {string}  '' for an invalid date
 */
export function formatSydneyDateTimeLocal(utcInstant) {
  if (!(utcInstant instanceof Date) || isNaN(utcInstant.getTime())) return '';
  const wall = new Date(utcInstant.getTime() + sydneyOffsetMinutes(utcInstant) * 60000);
  return wall.toISOString().slice(0, 16);
}

/**
 * A reporting period as "19/09/2026 08:00 to 19/09/2026 20:00 AEST" -- 24-hour
 * Sydney time, with the time zone abbreviation once at the end (or after each
 * end if the period spans a daylight-saving change).
 *
 * @param {Date} start
 * @param {Date} end
 * @returns {string}
 */
export function formatReportingPeriod(start, end) {
  const split = (d) => {
    const full = formatSydney(d); // "19/09/2026, 14:05 AEST"
    const m = full.match(/^(\d{2}\/\d{2}\/\d{4}),? (\d{2}:\d{2})(?: (\S+))?$/);
    return { stamp: m ? `${m[1]} ${m[2]}` : full, zone: m?.[3] || '' };
  };
  const a = split(start);
  const b = split(end);
  if (a.zone === b.zone) return `${a.stamp} to ${b.stamp}${b.zone ? ` ${b.zone}` : ''}`;
  return `${a.stamp} ${a.zone} to ${b.stamp} ${b.zone}`.replace(/  +/g, ' ');
}

/**
 * "19/09/2026 14:37hrs" -- Sydney time, 24-hour, no zone (the sitrep header's date).
 *
 * @param {Date} utcInstant
 * @returns {string}  '' for an invalid date
 */
export function formatSydneyHrs(utcInstant) {
  const local = formatSydneyDateTimeLocal(utcInstant); // "YYYY-MM-DDTHH:mm"
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}hrs` : '';
}
