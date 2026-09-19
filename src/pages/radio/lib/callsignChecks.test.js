import { describe, it, expect } from 'vitest';
import { DEFAULT_INTERVAL_MINUTES, DEFAULT_INTERVAL_OPTIONS, normaliseIntervals, parseIntervalInput, pickInterval, formatSince, formatAgoShort, planCallsignNotifications, normaliseCallsign, callsignTokens, prepareWatched, matchingWatched, resolveWatchName, evaluateCheck, buildCheckRows, formatMinutes } from './callsignChecks.js';

const MIN = 60000;
const now = Date.parse('2026-09-19T10:00:00Z');
const ago = (minutes) => now - minutes * MIN;
const watchedSet = (...names) => names.map(prepareWatched);

describe('normaliseCallsign / callsignTokens', () => {
  it('normalises for display and reduces to LAD-style tokens', () => {
    expect(normaliseCallsign('  tab56   (psn) ')).toBe('TAB56 (PSN)');
    expect(normaliseCallsign(null)).toBe('');
    expect(callsignTokens('PAR 56 Team')).toEqual(['par56']);
    expect(callsignTokens('PAR56 + PAR18')).toEqual(['par56', 'par18']);
    expect(callsignTokens('Command')).toEqual(['command']);
  });
});

describe('matchingWatched (lazy matching, as LAD matches assets to teams)', () => {
  it('ignores case, spaces, punctuation and extra words', () => {
    const w = watchedSet('PAR56');
    ['par56', 'PAR 56', 'Par-56', 'PAR56 (PSN)', 'PAR 56 Team'].forEach((s) => expect(matchingWatched(s, w)).toEqual(['PAR56']));
  });
  it('counts a multi-callsign subject for every watched callsign in it', () => {
    expect(matchingWatched('PAR56 + PAR18', watchedSet('PAR56', 'PAR18', 'PAR99')).sort()).toEqual(['PAR18', 'PAR56']);
  });
  it('matches a watched multi-callsign team from either of its callsigns', () => {
    expect(matchingWatched('PAR18', watchedSet('PAR56 + PAR18'))).toEqual(['PAR56 + PAR18']);
  });
  it('allows a letters-only tail either way (PAR56 ~ PAR56T) when nothing matches exactly', () => {
    expect(matchingWatched('PAR56T', watchedSet('PAR56'))).toEqual(['PAR56']);
    expect(matchingWatched('PAR56', watchedSet('PAR56T'))).toEqual(['PAR56T']);
    expect(matchingWatched('PAR56TRUCK', watchedSet('PAR56'))).toEqual(['PAR56']);
  });
  it('prefers the exact match: SES59 and SES59T are different callsigns when both are watched', () => {
    const w = watchedSet('SES59', 'SES59T');
    expect(matchingWatched('SES59T', w)).toEqual(['SES59T']);
    expect(matchingWatched('SES59', w)).toEqual(['SES59']);
  });
  it('never treats a longer number as a suffix (SES4 is not SES47)', () => {
    expect(matchingWatched('SES47', watchedSet('SES4'))).toEqual([]);
    expect(matchingWatched('SES4', watchedSet('SES47'))).toEqual([]);
  });
  it('matches names without digits by their words, and nothing for blanks', () => {
    expect(matchingWatched('command', watchedSet('COMMAND'))).toEqual(['COMMAND']);
    expect(matchingWatched('', watchedSet('PAR56'))).toEqual([]);
    expect(matchingWatched('BRAVO1', watchedSet('PAR56'))).toEqual([]);
  });
});

describe('resolveWatchName', () => {
  const teams = [{ Callsign: 'PAR56 Team' }, { Callsign: 'SES47' }, { Callsign: 'PAR18 + PAR19' }];
  it('uses the known team\'s own callsign when the typed text matches one', () => {
    expect(resolveWatchName('par 56', teams)).toBe('PAR56 TEAM');
    expect(resolveWatchName('ses47', teams)).toBe('SES47');
    expect(resolveWatchName('par19', teams)).toBe('PAR18 + PAR19');
  });
  it('keeps what was typed when no team matches, and returns nothing for blank', () => {
    expect(resolveWatchName('  zulu9 ', teams)).toBe('ZULU9');
    expect(resolveWatchName('  ', teams)).toBe('');
    expect(resolveWatchName('par56', undefined)).toBe('PAR56');
  });
});

describe('evaluateCheck', () => {
  it('is ok / due / overdue against the interval, and none when never heard', () => {
    expect(evaluateCheck(ago(10), 30, now)).toMatchObject({ state: 'ok', minutesSince: 10 });
    expect(evaluateCheck(ago(22), 30, now).state).toBe('ok');
    expect(evaluateCheck(ago(23), 30, now).state).toBe('due'); // 75% of 30 = 22.5 min
    expect(evaluateCheck(ago(30), 30, now)).toMatchObject({ state: 'overdue', minutesOverdue: 0 });
    expect(evaluateCheck(ago(45), 30, now)).toMatchObject({ state: 'overdue', minutesOverdue: 15 });
    expect(evaluateCheck(undefined, 30, now)).toEqual({ state: 'none', minutesSince: null, minutesOverdue: 0 });
  });
  it('never reports negative time (a clock a little ahead of the log)', () => {
    expect(evaluateCheck(now + 5 * MIN, 30, now).minutesSince).toBe(0);
  });
});

describe('buildCheckRows', () => {
  const entries = [
    { callsign: 'PAR 56 Team', at: ago(50) },
    { callsign: 'PAR56 (PSN)', at: ago(5) },
    { callsign: 'mtc19', at: ago(40) },
    { callsign: 'RESCUE1', at: ago(200) },
    { callsign: 'Alpha2', at: ago(1) },
    { callsign: 'Bravo3', at: 'not a date' },
    { callsign: '', at: ago(1) },
  ];
  it('takes the newest lazily matching entry per watched callsign and says how it was written', () => {
    const { watched } = buildCheckRows({ entries, watched: ['PAR56', 'MTC19'], intervalMinutes: 30, now });
    const par = watched.find((r) => r.callsign === 'PAR56');
    expect(par).toMatchObject({ state: 'ok', minutesSince: 5, heardAs: 'PAR56 (PSN)' });
    const mtc = watched.find((r) => r.callsign === 'MTC19');
    expect(mtc).toMatchObject({ state: 'overdue', minutesOverdue: 10, heardAs: '' }); // heard exactly as watched
  });
  it('orders watched rows longest-overdue first, then never heard, then due, then ok', () => {
    const { watched, overdueCount } = buildCheckRows({ entries, watched: ['PAR56', 'MTC19', 'RESCUE1', 'ZULU9'], intervalMinutes: 30, now });
    expect(watched.map((r) => `${r.callsign}:${r.state}`)).toEqual(['RESCUE1:overdue', 'MTC19:overdue', 'ZULU9:none', 'PAR56:ok']);
    expect(overdueCount).toBe(2);
  });
  it('offers only the 5 most recently heard callsigns by default', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ callsign: `Z${i + 1}`, at: ago(i + 1) }));
    const { recent } = buildCheckRows({ entries: many, watched: [], intervalMinutes: 30, now });
    expect(recent.map((r) => r.callsign)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
  });
  it('offers recently heard callsigns that no watched callsign already covers, newest first', () => {
    const { recent } = buildCheckRows({ entries, watched: ['PAR56'], intervalMinutes: 30, now, recentLimit: 2 });
    expect(recent.map((r) => r.callsign)).toEqual(['ALPHA2', 'MTC19']);
  });
});

describe('formatMinutes / formatAgoShort (short-hand times)', () => {
  it('formats minutes and hours in short-hand', () => {
    expect(formatMinutes(1)).toBe('1 min');
    expect(formatMinutes(42)).toBe('42 mins');
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(65)).toBe('1 hr 5 mins');
    expect(formatMinutes(180)).toBe('3 hrs');
    expect(formatMinutes(121)).toBe('2 hrs 1 min');
  });
  it('says how long ago, short', () => {
    const t = 1_000_000_000_000;
    expect(formatAgoShort(t - 2000, t)).toBe('just now');
    expect(formatAgoShort(t - 30000, t)).toBe('30 secs ago');
    expect(formatAgoShort(t - 39 * 60000, t)).toBe('39 mins ago');
    expect(formatAgoShort(t - 65 * 60000, t)).toBe('1 hr 5 mins ago');
    expect(formatAgoShort(t - 26 * 3600000, t)).toBe('1 day ago');
    expect(formatAgoShort(t - 50 * 3600000, t)).toBe('2 days ago');
    expect(formatAgoShort(t + 5000, t)).toBe('just now');
  });
});

describe('planCallsignNotifications', () => {
  const empty = () => ({ last: new Map(), acknowledged: new Set() });
  const row = (callsign, state, lastMs = 1000) => ({ callsign, state, lastMs });
  const t0 = 10 * 60 * MIN;

  it('announces a callsign once when it goes overdue, and not again while no repeat is set', () => {
    let r = planCallsignNotifications([row('A1', 'overdue')], empty(), 0, t0);
    expect(r.toNotify.map((n) => [n.row.callsign, n.repeat])).toEqual([['A1', false]]);
    r = planCallsignNotifications([row('A1', 'overdue')], r.state, 0, t0 + 60 * MIN);
    expect(r.toNotify).toEqual([]);
  });

  it('repeats every N minutes while still overdue, until acknowledged', () => {
    let r = planCallsignNotifications([row('A1', 'overdue')], empty(), 5, t0);
    r = planCallsignNotifications([row('A1', 'overdue')], r.state, 5, t0 + 4 * MIN);
    expect(r.toNotify).toEqual([]);
    r = planCallsignNotifications([row('A1', 'overdue')], r.state, 5, t0 + 5 * MIN);
    expect(r.toNotify.map((n) => n.repeat)).toEqual([true]);
    const key = r.toNotify[0].key;
    r = planCallsignNotifications([row('A1', 'overdue')], { ...r.state, acknowledged: new Set([key]) }, 5, t0 + 30 * MIN);
    expect(r.toNotify).toEqual([]);
  });

  it('re-arms when the callsign is heard again and later goes overdue again (a new last-heard time)', () => {
    let r = planCallsignNotifications([row('A1', 'overdue', 1000)], empty(), 5, t0);
    r = planCallsignNotifications([row('A1', 'ok', 5000)], r.state, 5, t0 + 10 * MIN);
    r = planCallsignNotifications([row('A1', 'overdue', 5000)], r.state, 5, t0 + 60 * MIN);
    expect(r.toNotify).toHaveLength(1);
  });

  it('ignores callsigns that are not overdue', () => {
    expect(planCallsignNotifications([row('A1', 'ok'), row('B2', 'due'), row('C3', 'none', null)], empty(), 5, t0).toNotify).toEqual([]);
  });
});

describe('formatSince (approximate time since heard)', () => {
  const t = 1_000_000_000_000;
  const since = (ms, opts) => formatSince(t - ms, t, opts);

  it('shows whole minutes up to an hour, with no tilde', () => {
    expect(since(2000)).toBe('just now');
    expect(since(40 * 1000)).toBe('<1 min ago');
    expect(since(60 * 1000)).toBe('1 min ago');
    expect(since(39 * 60000 + 20000)).toBe('39 mins ago');
    expect(since(59 * 60000)).toBe('59 mins ago');
  });
  it('rounds to the nearest hour from an hour up, with a ~ when it was rounded', () => {
    expect(since(60 * 60000)).toBe('1 hr ago'); // exact: no tilde
    expect(since(112 * 60000)).toBe('~2 hrs ago'); // 1 hr 52
    expect(since(157 * 60000)).toBe('~3 hrs ago'); // 2 hr 37
    expect(since(376 * 60000)).toBe('~6 hrs ago'); // 6 hr 16
    expect(since(127 * 60000)).toBe('~2 hrs ago');
    expect(since(120 * 60000)).toBe('2 hrs ago');
  });
  it('rounds to days from a day up', () => {
    expect(since(24 * 3600000)).toBe('1 day ago');
    expect(since(30 * 3600000)).toBe('~1 day ago');
    expect(since(72 * 3600000)).toBe('3 days ago');
  });
  it('can drop the "ago" for the compact chip line', () => {
    expect(since(112 * 60000, { suffix: '' })).toBe('~2 hrs');
    expect(since(39 * 60000, { suffix: '' })).toBe('39 mins');
  });
  it('never goes negative', () => {
    expect(formatSince(t + 60000, t)).toBe('just now');
  });
});

describe('contact periods', () => {
  it('defaults to every 2 hrs, with 2 hrs among the options', () => {
    expect(DEFAULT_INTERVAL_MINUTES).toBe(120);
    expect(DEFAULT_INTERVAL_OPTIONS).toContain(120);
  });
  it('normaliseIntervals keeps whole minutes 1..1440, unique and ascending, else falls back to the defaults', () => {
    expect(normaliseIntervals([60, 15, 15, 45.5, 0, -5, 'x', 2000, 1440, '30'])).toEqual([15, 30, 60, 1440]);
    expect(normaliseIntervals([])).toEqual(DEFAULT_INTERVAL_OPTIONS);
    expect(normaliseIntervals(null)).toEqual(DEFAULT_INTERVAL_OPTIONS);
  });
  it('parseIntervalInput turns minutes/hours into whole minutes or an error', () => {
    expect(parseIntervalInput('45', 'mins')).toEqual({ minutes: 45 });
    expect(parseIntervalInput('3', 'hrs')).toEqual({ minutes: 180 });
    expect(parseIntervalInput('1.5', 'hrs')).toEqual({ minutes: 90 });
    expect(parseIntervalInput('', 'mins').error).toBeTruthy();
    expect(parseIntervalInput('0', 'mins').error).toBeTruthy();
    expect(parseIntervalInput('abc', 'hrs').error).toBeTruthy();
    expect(parseIntervalInput('30.5', 'mins').error).toBeTruthy();
    expect(parseIntervalInput('25', 'hrs').error).toBeTruthy();
  });
  it('pickInterval keeps the selection while offered, else 2 hrs, else the first', () => {
    expect(pickInterval(60, [15, 60, 120])).toBe(60);
    expect(pickInterval(30, [15, 60, 120])).toBe(120);
    expect(pickInterval(30, [15, 45])).toBe(15);
  });
});
