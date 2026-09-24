/*
  Pure formatter for the log table's time cell. Displayed text is whichever
  mode is active (relative "N minutes ago", or absolute HH:mm -- no
  seconds, a live list doesn't need second-level precision; an entry from
  an earlier day than today also shows its short date, "17/09 21:36", so
  yesterday's entries aren't mistaken for today's). `title` is
  always the full precise date+time (with seconds and the calendar date),
  for the row's hover tooltip -- independent of which mode is displayed, so
  the exact day/time is always one hover away even though it isn't shown
  inline.
*/
import { relativeTimeFromNow } from './relativeTime.js';

const pad = (n) => String(n).padStart(2, '0');

/**
 * @param {string|null} isoTimeLogged
 * @param {'relative'|'absolute'} mode
 * @param {number} [nowMs]
 * @returns {{primary: string, title: string}}
 */
export function formatLogRowTime(isoTimeLogged, mode, nowMs = Date.now()) {
  if (!isoTimeLogged) return { primary: '-', title: '' };
  const date = new Date(isoTimeLogged);
  if (isNaN(date.getTime())) return { primary: '-', title: '' };

  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const dd = pad(date.getDate());
  const mo = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();

  const now = new Date(nowMs);
  const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const absolute = isToday ? `${hh}:${mm}` : `${dd}/${mo} ${hh}:${mm}`;

  return {
    primary: mode === 'relative' ? relativeTimeFromNow(date, nowMs) : absolute,
    title: `${dd}/${mo}/${yyyy} ${hh}:${mm}:${ss}`,
  };
}
