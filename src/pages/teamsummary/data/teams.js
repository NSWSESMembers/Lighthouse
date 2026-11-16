/*
  Turns Beacon's Teams/Search results into what a Team Summary card shows.

  Beacon timestamps are offset-free local time ("2026-11-15T10:05:00"),
  which the browser reads as local time: right for a page used in NSW.
*/

/** Teams/Search StatusTypeId: Standby, On Alert, Activated, Rest (not Stood Down). */
export const SEARCH_STATUS_IDS = [1, 2, 3, 4];

// Beacon's status names, the label to show and the card colour (teamsummary.css).
const STATUSES = {
  Activated: { label: 'Activated', key: 'activated' },
  Standby: { label: 'Standby', key: 'standby' },
  OnAlert: { label: 'On Alert', key: 'alert' },
  'On Alert': { label: 'On Alert', key: 'alert' },
  Rest: { label: 'Rest', key: 'rest' },
  StoodDown: { label: 'Stood Down', key: 'down' },
};

/** @returns {{label: string, key: string}} */
export function statusInfo(name) {
  return STATUSES[name] || { label: name || 'Unknown', key: 'other' };
}

function date(value) {
  return value ? new Date(value) : null;
}

/**
 * @param {object} raw  a Teams/Search result
 * @returns {{
 *   id: number, callsign: string, typeName: string, sector: string,
 *   statusName: string, statusLabel: string, statusKey: string, statusSince: Date|null,
 *   tasked: number, resources: string[],
 *   members: Array<{id: number, personId: number, name: string, leader: boolean, timeOn: Date|null}>,
 * }}
 */
export function teamFromBeacon(raw) {
  const statusName = raw.TeamStatusType?.Name || '';
  const status = statusInfo(statusName);
  return {
    id: raw.Id,
    callsign: raw.Callsign || '',
    typeName: raw.TeamType?.Name || '',
    sector: raw.Sector?.Name || '',
    statusName,
    statusLabel: status.label,
    statusKey: status.key,
    statusSince: date(raw.TeamStatusStartDate),
    tasked: Number(raw.TaskedJobCount) || 0,
    resources: (raw.Resources || []).map((r) => r.Name).filter(Boolean),
    members: (raw.Members || [])
      .filter((m) => m && m.Person)
      .map((m) => ({
        id: m.Id,
        personId: m.Person.Id,
        name: m.Person.FullName || `${m.Person.FirstName || ''} ${m.Person.LastName || ''}`.trim(),
        leader: Boolean(m.TeamLeader),
        timeOn: date(m.TimeOn),
      })),
  };
}

/** Shown without being picked when the page opens: activated field teams, as on the old page. */
export function shownByDefault(team) {
  return team.typeName === 'Field' && team.statusName === 'Activated';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

/** "Nov 15 09.05", the old page's time stamp (moment's 'MMM D HH.mm'). */
export function stampText(d) {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${pad(d.getHours())}.${pad(d.getMinutes())}`;
}

/** Whole hours from `since` to `now` (0 for a missing date). */
export function hoursSince(since, now) {
  if (!(since instanceof Date) || isNaN(since)) return 0;
  return Math.max(0, Math.floor((now - since) / 3600e3));
}

/**
 * How long a team or member has been on: amber from 10 hours, red past 12
 * (the old page's limits).
 *
 * @returns {'' | 'amber' | 'red'}
 */
export function hoursLevel(hours) {
  if (hours > 12) return 'red';
  if (hours >= 10) return 'amber';
  return '';
}

/**
 * A team's tasked incident count: red with none (free to task), amber with
 * one, as on the old page.
 *
 * @returns {'' | 'amber' | 'red'}
 */
export function taskedLevel(count) {
  if (count === 0) return 'red';
  if (count === 1) return 'amber';
  return '';
}

/** "Active Incidents: 2", the old page's "Active Jobs: 2". */
export function taskedText(count) {
  return `Active Incidents: ${count || 0}`;
}

/**
 * Beacon's Messages/Create link with the team's members filled in, the
 * same lhquickrecipient list Lighthouse's Beacon script reads elsewhere.
 */
export function messageUrl(source, personIds) {
  return `${source}/Messages/Create?lhquickrecipient=${encodeURIComponent(JSON.stringify(personIds))}`;
}
