/*
  Deciding which newly arrived log entries deserve an "urgent" alert: an
  Important or Action Required entry this console has not seen before and did
  not write itself. Pure -- the banner, sound and notification are in
  features/urgent-alerts.js.
*/

/** @param {{Important?: boolean, ActionRequired?: boolean}} entry @returns {'both'|'action'|'important'|null} */
export function classifyUrgency(entry) {
  if (entry?.Important && entry?.ActionRequired) return 'both';
  if (entry?.ActionRequired) return 'action';
  if (entry?.Important) return 'important';
  return null;
}

const KIND_LABELS = { both: 'Important + Action required', action: 'Action required', important: 'Important' };

/** @param {'both'|'action'|'important'} kind */
export function urgencyLabel(kind) {
  return KIND_LABELS[kind];
}

/**
 * @param {object[]} entries  raw entries (Id, Important, ActionRequired, Subject, Text, CreatedOn, CreatedBy)
 * @param {object} state
 * @param {Set<string|number>} state.seen  ids already known (from loads, earlier pushes, or our own submissions)
 * @param {string|number|null} [state.personId]  the logged-in person: their own entries never alert
 * @param {boolean} [state.suppress]  true while this console has a submit in flight (its own SignalR echo can arrive first)
 * @param {number} state.now  epoch ms
 * @param {number} [state.maxAgeMs]  ignore entries created longer ago than this (a backfilled old row isn't "urgent news")
 * @param {{important: boolean, action: boolean}} [state.kinds]  which flags count: Important entries, Action Required entries (both by default)
 * @returns {{urgent: Array<{id: string|number, kind: string, callsign: string, text: string, createdOn: string|null}>, seenIds: Array<string|number>}}
 *          seenIds = every id in `entries`, for the caller to remember (whether or not it alerted)
 */
export function pickUrgentEntries(entries, { seen, personId = null, suppress = false, now, maxAgeMs = 15 * 60000, kinds = { important: true, action: true } }) {
  const urgent = [];
  const seenIds = [];
  entries.forEach((entry) => {
    if (entry == null || entry.Id == null) return;
    seenIds.push(entry.Id);
    if (seen.has(entry.Id)) return;
    const kind = classifyUrgency(entry);
    if (!kind) return;
    // only the flags the operator has asked to be alerted about
    const wanted = ((kind === 'important' || kind === 'both') && kinds.important) || ((kind === 'action' || kind === 'both') && kinds.action);
    if (!wanted) return;
    if (suppress) return;
    if (personId != null && entry.CreatedBy?.Id != null && String(entry.CreatedBy.Id) === String(personId)) return;
    const created = entry.CreatedOn ? new Date(entry.CreatedOn).getTime() : NaN;
    if (!isNaN(created) && now - created > maxAgeMs) return;
    urgent.push({ id: entry.Id, kind, callsign: entry.Subject || '(no callsign)', text: entry.Text || '', createdOn: entry.CreatedOn || null });
  });
  return { urgent, seenIds };
}
