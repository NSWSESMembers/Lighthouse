/*
  Pure list-merge for the Radio Ops Console's log view: combines a REST page
  or a SignalR push into the currently-displayed entries, deduplicating by
  Beacon's own record id (an update reuses the same id, so this also
  naturally reconciles an edit/resolve pushed after the initial insert) and
  keeping the result sorted newest-logged-first.
*/

/**
 * @param {Array<{Id: string|number, TimeLogged: string}>} existing
 * @param {Array<{Id: string|number, TimeLogged: string}>} incoming
 * @returns {Array<object>}  new array; `existing`/`incoming` are untouched
 */
export function mergeLogEntries(existing, incoming) {
  const byId = new Map(existing.map((entry) => [entry.Id, entry]));
  for (const entry of incoming) {
    byId.set(entry.Id, entry);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.TimeLogged).getTime() - new Date(a.TimeLogged).getTime());
}

/**
 * Whether `entry` falls inside the currently-loaded filter scope, so a live
 * SignalR push can be accepted/rejected without a full refetch. Beacon's
 * push payload is the full entry object (same shape `searchLog` returns),
 * so the same field checks apply as the REST filters -- including the
 * date window, so a push landing after a closed windowEndInput doesn't
 * silently grow a view the operator intended to be a bounded snapshot.
 *
 * @param {object} entry
 * @param {{entityIds?: Array<string|number>, jobIds?: Array<string|number>,
 *          eventIds?: Array<string|number>, tagIds?: Array<string|number>,
 *          dateFrom?: Date, dateTo?: Date}} scope
 * @returns {boolean}
 */
export function entryMatchesScope(entry, scope = {}) {
  const { entityIds = [], jobIds = [], eventIds = [], tagIds = [], dateFrom, dateTo } = scope;
  if (entityIds.length > 0 && !entityIds.some((id) => String(id) === String(entry.Entity?.Id))) return false;
  if (jobIds.length > 0 && !jobIds.some((id) => String(id) === String(entry.JobId))) return false;
  if (eventIds.length > 0 && !eventIds.some((id) => String(id) === String(entry.EventId))) return false;
  if (tagIds.length > 0) {
    const entryTagIds = (entry.Tags || []).map((t) => String(t.Id));
    if (!tagIds.some((id) => entryTagIds.includes(String(id)))) return false;
  }
  if (dateFrom || dateTo) {
    const loggedMs = entry.TimeLogged ? new Date(entry.TimeLogged).getTime() : NaN;
    // No parseable timestamp to compare against a bounded window -- treat
    // as out of scope rather than guessing it belongs.
    if (Number.isNaN(loggedMs)) return false;
    if (dateFrom && loggedMs < new Date(dateFrom).getTime()) return false;
    if (dateTo && loggedMs > new Date(dateTo).getTime()) return false;
  }
  return true;
}
