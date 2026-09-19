/*
  Radio-check / welfare timers: when was each watched callsign last heard, and
  is it overdue for contact? Pure -- fed by the entries already loaded in the
  console (so it only knows what the log window below contains).

  Callsigns are matched "lazily", the same way LAD matches trackable assets to
  team callsigns (tasking/utils/assetTeamMatching.js): case, spaces and
  punctuation are ignored, a callsign is reduced to its <letters><digits>
  tokens ("PAR 56 Team" -> par56; "PAR56 + PAR18" -> par56, par18), an exact
  token match wins, and only when there is none does a near match count --
  one token being the other plus a letters-only tail ("PAR56" ~ "PAR56T"),
  never a longer number ("SES4" is not "SES47").
*/
import { normAssetName, extractTeamTokens } from '../../tasking/utils/assetTeamMatching.js';

/** @param {string} callsign @returns {string}  trimmed, upper-cased, single-spaced ('' for nothing) */
export function normaliseCallsign(callsign) {
  return String(callsign || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/** @param {string} callsign @returns {string[]}  LAD's callsign tokens (lower-case, no spaces/punctuation) */
export function callsignTokens(callsign) {
  return extractTeamTokens({ callsign: () => callsign });
}

const LETTERS_ONLY = /^[a-z]+$/;
const HAS_DIGIT = /\d/;

/** @returns {'exact'|'near'|null} how two tokens relate */
function relateTokens(a, b) {
  if (a === b) return 'exact';
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (HAS_DIGIT.test(short) && long.startsWith(short) && LETTERS_ONLY.test(long.slice(short.length))) return 'near';
  return null;
}

/**
 * @param {string} callsign
 * @returns {{callsign: string, tokens: string[], flat: string}}  a watched callsign prepared for matching
 */
export function prepareWatched(callsign) {
  return { callsign, tokens: callsignTokens(callsign), flat: normAssetName(callsign) };
}

/**
 * Which watched callsigns an entry's callsign ("subject") counts as contact for.
 * Every watched callsign sharing an exact token (so "PAR56 + PAR18" counts for
 * both); otherwise the single closest near match; otherwise none.
 *
 * @param {string} subject
 * @param {Array<ReturnType<typeof prepareWatched>>} watched
 * @returns {string[]}  watched callsigns
 */
export function matchingWatched(subject, watched) {
  const tokens = callsignTokens(subject);
  const flat = normAssetName(subject);
  if (!flat) return [];

  const exact = watched.filter((w) => w.tokens.some((wt) => tokens.includes(wt)) || (w.flat && w.flat === flat));
  if (exact.length > 0) return exact.map((w) => w.callsign);

  let best = null;
  let bestGap = Infinity;
  watched.forEach((w) => {
    w.tokens.forEach((wt) =>
      tokens.forEach((t) => {
        if (relateTokens(wt, t) !== 'near') return;
        const gap = Math.abs(wt.length - t.length); // prefer the closest (shortest tail), as LAD prefers the shortest asset name
        if (gap < bestGap) {
          best = w;
          bestGap = gap;
        }
      }),
    );
  });
  return best ? [best.callsign] : [];
}

/**
 * A callsign to watch, in the name of a known team when the typed text lazily
 * matches one (exact token), else as typed.
 *
 * @param {string} input
 * @param {Array<{Callsign?: string}>} teams  known teams
 * @returns {string}  normalised callsign ('' for nothing)
 */
export function resolveWatchName(input, teams) {
  const typed = normaliseCallsign(input);
  if (!typed) return '';
  const wanted = callsignTokens(typed);
  const team = (teams || []).find((t) => t?.Callsign && callsignTokens(t.Callsign).some((tok) => wanted.includes(tok)));
  return team ? normaliseCallsign(team.Callsign) : typed;
}

/**
 * @param {number|undefined|null} lastMs
 * @param {number} intervalMinutes
 * @param {number} now  epoch ms
 * @returns {{state: 'none'|'ok'|'due'|'overdue', minutesSince: number|null, minutesOverdue: number}}
 *          none = never heard in the loaded log; due = 75% of the interval used; overdue = interval passed
 */
export function evaluateCheck(lastMs, intervalMinutes, now) {
  if (lastMs == null) return { state: 'none', minutesSince: null, minutesOverdue: 0 };
  const minutesSince = Math.max(0, Math.floor((now - lastMs) / 60000));
  if (minutesSince >= intervalMinutes) return { state: 'overdue', minutesSince, minutesOverdue: minutesSince - intervalMinutes };
  if (minutesSince >= intervalMinutes * 0.75) return { state: 'due', minutesSince, minutesOverdue: 0 };
  return { state: 'ok', minutesSince, minutesOverdue: 0 };
}

const URGENCY = { overdue: 0, none: 1, due: 2, ok: 3 };

/**
 * @param {object} args
 * @param {Array<{callsign: string, at: Date|number|string|null}>} args.entries  loaded log entries
 * @param {string[]} args.watched  callsigns being watched
 * @param {number} args.intervalMinutes
 * @param {number} args.now
 * @param {number} [args.recentLimit]  how many not-watched callsigns to offer (the 5 most recently heard)
 * @returns {{watched: Array<object>, recent: Array<{callsign: string, lastMs: number}>, overdueCount: number}}
 *          watched rows: most urgent first (longest overdue at the top); `heardAs` is how the most
 *          recent contact was written in the log when that differs from the watched name
 */
export function buildCheckRows({ entries, watched, intervalMinutes, now, recentLimit = 5 }) {
  const prepared = watched.map(prepareWatched);
  const lastFor = new Map(); // watched callsign -> { ms, subject }
  const unmatched = new Map(); // flat callsign -> { ms, subject }

  entries.forEach(({ callsign, at }) => {
    const subject = normaliseCallsign(callsign);
    const ms = at == null ? NaN : new Date(at).getTime();
    if (!subject || isNaN(ms)) return;
    const matches = matchingWatched(subject, prepared);
    if (matches.length === 0) {
      const key = normAssetName(subject);
      if (!unmatched.has(key) || ms > unmatched.get(key).ms) unmatched.set(key, { ms, subject });
      return;
    }
    matches.forEach((w) => {
      if (!lastFor.has(w) || ms > lastFor.get(w).ms) lastFor.set(w, { ms, subject });
    });
  });

  const rows = watched.map((callsign) => {
    const last = lastFor.get(callsign);
    const heardAs = last && normAssetName(last.subject) !== normAssetName(callsign) ? last.subject : '';
    return { callsign, lastMs: last ? last.ms : null, heardAs, ...evaluateCheck(last ? last.ms : null, intervalMinutes, now) };
  });
  rows.sort((a, b) => URGENCY[a.state] - URGENCY[b.state] || b.minutesOverdue - a.minutesOverdue || (b.minutesSince ?? 0) - (a.minutesSince ?? 0) || a.callsign.localeCompare(b.callsign));

  const recent = [...unmatched.values()]
    .map(({ subject, ms }) => ({ callsign: subject, lastMs: ms }))
    .sort((a, b) => b.lastMs - a.lastMs)
    .slice(0, recentLimit);

  return { watched: rows, recent, overdueCount: rows.filter((r) => r.state === 'overdue').length };
}

/** Short-hand durations: "1 min", "42 mins", "1 hr", "2 hrs", "1 hr 5 mins" */
export function formatMinutes(minutes) {
  const unit = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (minutes < 60) return unit(minutes, 'min', 'mins');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${unit(h, 'hr', 'hrs')} ${unit(m, 'min', 'mins')}` : unit(h, 'hr', 'hrs');
}

/**
 * Short-hand "how long ago": "just now", "30 secs ago", "39 mins ago", "1 hr 5 mins ago", "2 days ago".
 * @param {number} thenMs
 * @param {number} nowMs
 */
export function formatAgoShort(thenMs, nowMs) {
  const seconds = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} secs ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 24 * 60) {
    const days = Math.floor(minutes / (24 * 60));
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  return `${formatMinutes(minutes)} ago`;
}

/**
 * Which overdue callsigns should raise a browser notification now: once when a
 * watched callsign goes overdue, then -- if repeats are on -- every
 * `repeatMinutes` while it is still unheard and unacknowledged. A callsign that
 * is heard again (or unwatched) drops out and can notify afresh next time.
 *
 * @param {Array<{callsign: string, state: string, lastMs: number|null}>} rows  from buildCheckRows
 * @param {{last: Map<string, number>, acknowledged: Set<string>}} state  what was announced already
 * @param {number} repeatMinutes  0 = never repeat
 * @param {number} now  epoch ms
 * @returns {{toNotify: Array<{row: object, key: string, repeat: boolean}>, state: {last: Map<string, number>, acknowledged: Set<string>}}}
 */
export function planCallsignNotifications(rows, state, repeatMinutes, now) {
  const keyOf = (r) => `${r.callsign}|${r.lastMs}`;
  const overdue = rows.filter((r) => r.state === 'overdue');
  const overdueKeys = new Set(overdue.map(keyOf));
  const next = {
    last: new Map([...state.last].filter(([k]) => overdueKeys.has(k))),
    acknowledged: new Set([...state.acknowledged].filter((k) => overdueKeys.has(k))),
  };
  const repeatMs = (repeatMinutes || 0) * 60000;
  const toNotify = [];
  overdue.forEach((row) => {
    const key = keyOf(row);
    if (!next.last.has(key)) {
      next.last.set(key, now);
      toNotify.push({ row, key, repeat: false });
    } else if (repeatMs > 0 && !next.acknowledged.has(key) && now - next.last.get(key) >= repeatMs) {
      next.last.set(key, now);
      toNotify.push({ row, key, repeat: true });
    }
  });
  return { toNotify, state: next };
}

/**
 * "Time since last heard", kept short: whole minutes up to an hour, then rounded to the nearest
 * hour (or day) with a leading "~" whenever the rounding changed the value.
 * "just now" | "<1 min ago" | "39 mins ago" | "~2 hrs ago" | "1 hr ago" | "~1 day ago"
 *
 * @param {number} thenMs
 * @param {number} nowMs
 * @param {{suffix?: string}} [options]  suffix defaults to " ago" (use '' for a bare "~2 hrs")
 * @returns {string}
 */
export function formatSince(thenMs, nowMs, { suffix = ' ago' } = {}) {
  const seconds = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `<1 min${suffix}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'min' : 'mins'}${suffix}`;

  const unitFor = (unitMinutes, one, many) => {
    const exact = minutes / unitMinutes;
    const rounded = Math.round(exact);
    const tilde = minutes % unitMinutes !== 0 ? '~' : '';
    return `${tilde}${rounded} ${rounded === 1 ? one : many}${suffix}`;
  };
  return minutes < 24 * 60 ? unitFor(60, 'hr', 'hrs') : unitFor(24 * 60, 'day', 'days');
}

// ---- the "expect contact every ..." periods (configurable in Settings) ----

export const DEFAULT_INTERVAL_MINUTES = 120;
export const DEFAULT_INTERVAL_OPTIONS = [15, 30, 60, 120, 240];
export const MAX_INTERVAL_MINUTES = 24 * 60;

/**
 * @param {unknown} list
 * @returns {number[]}  whole minutes 1..1440, unique, ascending; the defaults when nothing usable is given
 */
export function normaliseIntervals(list) {
  const valid = (Array.isArray(list) ? list : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_INTERVAL_MINUTES);
  const unique = [...new Set(valid)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_INTERVAL_OPTIONS];
}

/**
 * @param {string|number} amount  what was typed
 * @param {'mins'|'hrs'} unit
 * @returns {{minutes: number}|{error: string}}
 */
export function parseIntervalInput(amount, unit) {
  const n = Number(amount);
  if (String(amount).trim() === '' || !Number.isFinite(n) || n <= 0) return { error: 'Enter a number greater than 0.' };
  const minutes = unit === 'hrs' ? n * 60 : n;
  if (!Number.isInteger(minutes)) return { error: unit === 'hrs' ? 'Use a whole number of minutes, for example 90 mins or 1.5 hrs.' : 'Use a whole number of minutes.' };
  if (minutes > MAX_INTERVAL_MINUTES) return { error: 'The longest period is 24 hrs.' };
  return { minutes };
}

/**
 * @param {number} current  the selected period
 * @param {number[]} options
 * @returns {number}  `current` if still offered, else the default (when offered) or the first option
 */
export function pickInterval(current, options) {
  if (options.includes(current)) return current;
  return options.includes(DEFAULT_INTERVAL_MINUTES) ? DEFAULT_INTERVAL_MINUTES : options[0];
}
