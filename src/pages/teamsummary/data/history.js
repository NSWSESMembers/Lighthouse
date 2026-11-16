/*
  A team's recent history (Beacon's Teams/{id}/History) for its card:
  the latest few entries, members added or removed together rolled into
  one, and where the team was last seen.

  Rows are { Name, Description, TimeStamp }, e.g.
    "Team set as Activated"            / "Status changed by Alex Nguyen"
    "Sam Okafor added to team"         / "Member added by Alex Nguyen"
    "DEM01 Onsite on job 2611-0013"    / "Tasking updated by Alex Nguyen"
*/

/** How many entries a card shows (the old page's five). */
export const HISTORY_LIMIT = 5;

const INCIDENT_NUMBER = /\d{4}-\d{4}/;
const MEMBER_CHANGE = /^(.+)\s(added|removed) (to|from) team$/;
const POSITION = /(Enroute|Onsite|Offsite|Complete) on job (\d{4}-\d{4})/;

function time(row) {
  const t = new Date(row.TimeStamp);
  return isNaN(t) ? 0 : t.getTime();
}

/** Newest first. Beacon sends them that way; sorting keeps it true if it ever doesn't. */
function newestFirst(rows) {
  return (rows || [])
    .filter((r) => r && typeof r.Name === 'string')
    .map((r, i) => ({ r, i }))
    .sort((a, b) => time(b.r) - time(a.r) || a.i - b.i)
    .map(({ r }) => r);
}

/** Beacon's description without its " by <person>" tail. */
export function trimDescription(description) {
  if (!description) return '';
  const at = description.lastIndexOf(' by ');
  return (at > 0 ? description.slice(0, at) : description).trim();
}

/**
 * The entries to show on a card.
 *
 * @param {Array<{Name: string, Description?: string, TimeStamp: string}>} rows
 * @param {object} opts
 * @param {string} opts.callsign  left out of incident entries ("Onsite on job 2611-0013")
 * @param {boolean} [opts.memberChanges=true]  include members added and removed
 * @param {number} [opts.limit=HISTORY_LIMIT]
 * @returns {Array<{key: string, title: string, detail: string, at: Date, incidentNumber: string}>}
 *   `incidentNumber` is '' for entries not about an incident
 */
export function historyEntries(rows, { callsign, memberChanges = true, limit = HISTORY_LIMIT }) {
  const list = newestFirst(rows).filter((r) => memberChanges || !MEMBER_CHANGE.test(r.Name));
  const out = [];
  for (let i = 0; i < list.length && out.length < limit;) {
    const row = list[i];
    const change = row.Name.match(MEMBER_CHANGE);
    if (change) {
      // Members added (or removed) at the same moment: one entry.
      const names = [change[1]];
      let j = i + 1;
      for (; j < list.length; j++) {
        const next = list[j].Name.match(MEMBER_CHANGE);
        if (!next || next[2] !== change[2] || list[j].TimeStamp !== row.TimeStamp) break;
        names.push(next[1]);
      }
      if (names.length > 1) {
        out.push({
          key: `${row.TimeStamp}|members-${change[2]}|${names.join(',')}`,
          title: `Members ${change[2]} ${change[3]} team`,
          detail: names.join(', '),
          at: new Date(row.TimeStamp),
          incidentNumber: '',
        });
        i = j;
        continue;
      }
    }
    const number = (row.Name.match(INCIDENT_NUMBER) || [''])[0];
    let title = row.Name;
    if (number && callsign) title = title.replace(callsign, '').trim();
    out.push({
      key: `${row.TimeStamp}|${row.Name}|${i}`,
      title,
      // "Team set as Activated" says it all; its description is noise.
      detail: /^Team set as/.test(row.Name) ? '' : trimDescription(row.Description),
      at: new Date(row.TimeStamp),
      incidentNumber: number,
    });
    i++;
  }
  return out;
}

/**
 * Where the team was last seen: its latest Enroute, Onsite, Offsite or
 * Complete on an incident.
 *
 * @returns {{statusName: string, incidentNumber: string, at: Date} | null}
 */
export function lastPosition(rows) {
  for (const row of newestFirst(rows)) {
    const m = row.Name.match(POSITION);
    if (m) return { statusName: m[1], incidentNumber: m[2], at: new Date(row.TimeStamp) };
  }
  return null;
}

/**
 * "24 minutes ago", "an hour ago": moment's fromNow(), which the old page
 * used for where the team was last seen (same wording and thresholds).
 */
export function agoText(at, now) {
  if (!(at instanceof Date) || isNaN(at)) return '';
  const secs = Math.round((now - at) / 1000);
  const mins = Math.round(secs / 60);
  const hours = Math.round(mins / 60);
  const days = Math.round(hours / 24);
  if (secs < 45) return 'a few seconds ago';
  if (secs < 90) return 'a minute ago';
  if (mins < 45) return `${mins} minutes ago`;
  if (mins < 90) return 'an hour ago';
  if (hours < 22) return `${hours} hours ago`;
  if (hours < 36) return 'a day ago';
  return `${days} days ago`;
}
