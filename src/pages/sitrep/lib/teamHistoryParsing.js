/*
  Turns Beacon's per-team History log (a flat, free-text audit trail -- see
  BeaconClient/team.js#getHistory) into structured status and membership
  intervals.

  Beacon does not expose a dedicated "activation intervals" or "membership
  history" endpoint. The History log's `Name` field is the only place status
  transitions and member add/remove events are recorded with a timestamp, and
  it's prose, not structured data -- these regexes are reverse-engineered
  from the only confirmed sample text (src/pages/teamsummary.js's existing
  "Team set as ..." and "<name> added|removed to|from team" matches).
  A History entry whose Name doesn't match either pattern is simply not a
  status/membership event (e.g. a resource change) and is ignored here.
*/

const STATUS_CHANGE = /^Team set as (.+)$/i;
const MEMBER_CHANGE = /^(.+?)\s(added|removed)\s(?:to|from)\s+team/i;

/**
 * @param {{Name: string, TimeStamp: string}} entry
 * @returns {{status: string}|null}
 */
export function matchStatusChange(entry) {
  const match = entry?.Name?.match(STATUS_CHANGE);
  return match ? { status: match[1].trim() } : null;
}

/**
 * @param {{Name: string, TimeStamp: string}} entry
 * @returns {{name: string, action: 'added'|'removed'}|null}
 */
export function matchMemberChange(entry) {
  const match = entry?.Name?.match(MEMBER_CHANGE);
  return match ? { name: match[1].trim(), action: match[2].toLowerCase() } : null;
}

function sortByTimeAscending(rows) {
  return [...rows].sort((a, b) => new Date(a.TimeStamp).getTime() - new Date(b.TimeStamp).getTime());
}

/**
 * Reconstruct this team's status intervals from its History log, oldest
 * first. The last interval's `end` is null (still the team's current
 * status, as far as the fetched history shows).
 *
 * @param {Array<{Name: string, TimeStamp: string}>} historyRows
 * @returns {Array<{status: string, start: Date, end: Date|null}>}
 */
export function extractStatusIntervals(historyRows) {
  const changes = sortByTimeAscending(historyRows)
    .map((entry) => {
      const match = matchStatusChange(entry);
      return match ? { status: match.status, time: new Date(entry.TimeStamp) } : null;
    })
    .filter(Boolean);

  return changes.map((change, index) => ({
    status: change.status,
    start: change.time,
    end: index + 1 < changes.length ? changes[index + 1].time : null,
  }));
}

/**
 * Reconstruct this team's membership intervals from its History log, keyed
 * by the *name string* recorded in the log -- Beacon's history entries do
 * not carry a stable person id, only free text (see fetchSitrepData.js for
 * how these get matched against current members' stable ids where possible).
 * Repeated add/remove cycles for the same name produce separate intervals.
 * An "added" with no prior open interval starts a new one; a "removed" with
 * no open interval is ignored (can't close what we never saw open -- most
 * likely the "added" event fell outside the fetched history page).
 *
 * @param {Array<{Name: string, TimeStamp: string}>} historyRows
 * @returns {Array<{name: string, start: Date, end: Date|null}>}
 */
export function extractMembershipIntervals(historyRows) {
  const changes = sortByTimeAscending(historyRows)
    .map((entry) => {
      const match = matchMemberChange(entry);
      return match ? { ...match, time: new Date(entry.TimeStamp) } : null;
    })
    .filter(Boolean);

  const openByName = new Map(); // name -> interval currently being built
  const intervals = [];

  for (const change of changes) {
    if (change.action === 'added') {
      // A second "added" while one is already open (Beacon shouldn't emit
      // this, but the log is prose -- be defensive) closes nothing; treat it
      // as confirming the same open interval rather than opening a duplicate.
      if (!openByName.has(change.name)) {
        const interval = { name: change.name, start: change.time, end: null };
        openByName.set(change.name, interval);
        intervals.push(interval);
      }
    } else if (change.action === 'removed') {
      const open = openByName.get(change.name);
      if (open) {
        open.end = change.time;
        openByName.delete(change.name);
      }
      // else: removed without a seen "added" -- the join predates the
      // fetched history window; nothing to close, so it's dropped. The
      // caller can detect this by fewer intervals than history's earliest
      // page reaches.
    }
  }

  return intervals;
}

/**
 * Whether the fetched history page(s) plausibly reach back far enough to
 * cover `sinceInstant` -- i.e. either every page of history was retrieved
 * (fewer rows returned than the total), or the oldest fetched row is at or
 * before `sinceInstant`. When false, status/membership intervals derived
 * from this team's history may be missing earlier transitions (a team that
 * was already Activated, or a member already added, before the oldest
 * fetched entry looks indistinguishable from one that started exactly then).
 *
 * @param {{results: Array<{TimeStamp: string}>, totalItems: number}} historyPage
 * @param {Date} sinceInstant
 * @returns {boolean}
 */
export function historyCoversInstant(historyPage, sinceInstant) {
  const { results, totalItems } = historyPage;
  if (results.length >= totalItems) return true; // every page fetched
  if (results.length === 0) return false;
  const oldest = sortByTimeAscending(results)[0];
  return new Date(oldest.TimeStamp).getTime() <= sinceInstant.getTime();
}
