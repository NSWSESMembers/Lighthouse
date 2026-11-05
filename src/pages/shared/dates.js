/*
  Beacon's times as ISO 8601 with the UTC offset, for the CSV exports:
  "2026-10-27T10:00:00+11:00".

  Beacon sends offset-free NSW local times ("2026-10-27T10:00:00"). The
  offset is worked out for Sydney at that moment, not from the computer's
  timezone, so an export says the same thing wherever it's made, and the
  daylight saving changeover gets +10:00 / +11:00 right.
*/

export const TIME_ZONE = 'Australia/Sydney';

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;
const WITH_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

const OFFSET_FMT = new Intl.DateTimeFormat('en-AU', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' });
const PARTS_FMT = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIME_ZONE, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Sydney's offset from UTC at `ms`, in minutes (600 or 660). */
function offsetMinutes(ms) {
  const name = OFFSET_FMT.formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName').value; // "GMT+11:00"
  const m = name.match(/([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0; // "GMT" on its own
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

function offsetText(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const a = Math.abs(minutes);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** An instant as Sydney wall-clock time with its offset. */
function formatInstant(ms) {
  const p = Object.fromEntries(PARTS_FMT.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetText(offsetMinutes(ms))}`;
}

/**
 * @param {string|null|undefined} value  a Beacon time
 * @returns {string}  ISO 8601 with offset, or '' for no / unreadable time
 */
export function isoDateTime(value) {
  if (!value || typeof value !== 'string') return '';
  const s = value.trim();
  if (WITH_OFFSET.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? '' : formatInstant(ms);
  }
  const m = s.match(LOCAL);
  if (!m) return '';
  const [, y, mo, d, h, mi, sec = '00'] = m;
  // Wall time read as if it were UTC, then moved back by Sydney's offset.
  // Checking the offset again at the result settles the changeover days.
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +sec);
  let ms = wall - offsetMinutes(wall) * 60e3;
  ms = wall - offsetMinutes(ms) * 60e3;
  return `${y}-${mo}-${d}T${h}:${mi}:${sec}${offsetText(offsetMinutes(ms))}`;
}

/** "2026-10-27 1015" for the file name: Sydney time. */
export function fileStamp(date) {
  const p = Object.fromEntries(PARTS_FMT.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}${p.minute}`;
}
