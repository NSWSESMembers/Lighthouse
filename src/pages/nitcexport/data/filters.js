/*
  The NITC screen's filters, as Beacon's "Export (Filtered)" button passes
  them (src/injectscripts/nitc/nitc.js): comma-separated ids in the URL,
  next to the usual host / source / userId / hq / start / end
  (src/pages/shared/params.js). `hq` is the screen's HQ filter.
*/

/**
 * @param {string} search  location.search
 * @param {string[]} hqIds  parsePageParams().hqIds
 * @returns {{EntityIds?: string, NonIncidentTypeIds?: string, TagIds?: string, IncludeCompleted?: string}}
 *          what BeaconClient.nitc.search takes; a filter that wasn't set is left out
 */
export function nitcFilters(search, hqIds) {
  const p = new URLSearchParams(search);
  const ids = (name) => (p.get(name) || '').split(',').map((s) => s.trim()).filter(Boolean).join(',');
  const filters = {};
  if (hqIds.length) filters.EntityIds = hqIds.join(',');
  if (ids('NonIncidentTypeIds')) filters.NonIncidentTypeIds = ids('NonIncidentTypeIds');
  if (ids('TagIds')) filters.TagIds = ids('TagIds');
  if (p.get('IncludeCompleted') === 'true' || p.get('IncludeCompleted') === 'false') filters.IncludeCompleted = p.get('IncludeCompleted');
  return filters;
}

const count = (list, one, many) => {
  const n = list ? list.split(',').length : 0;
  return n ? `${n} ${n === 1 ? one : many}` : '';
};

/**
 * "Filtered to 2 task types and 1 tag, completed tasks included", for under
 * the header, or '' with no filters beyond the HQ and dates.
 */
export function filtersText(filters) {
  const parts = [count(filters.NonIncidentTypeIds, 'task type', 'task types'), count(filters.TagIds, 'tag', 'tags')].filter(Boolean);
  const completed = filters.IncludeCompleted === 'true' ? 'completed tasks included'
    : filters.IncludeCompleted === 'false' ? 'completed tasks left out' : '';
  if (!parts.length) return completed ? completed[0].toUpperCase() + completed.slice(1) : '';
  return `Filtered to ${parts.join(' and ')}${completed ? `, ${completed}` : ''}`;
}
