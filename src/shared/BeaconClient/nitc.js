import { requestPaginated } from './core/request.js';

/**
 * Non-Incident Task Card search.
 *
 * @param {object} params  { host, EntityIds?, NonIncidentTypeIds?, TagIds?, IncludeCompleted? }
 * @param {object} [opts]  { onProgress, onPage, signal } forwarded to requestPaginated
 * @returns {Promise<{Results: any[]}>}
 */
export async function search(params, userId = 'notPassed', token, StartDate, EndDate, opts = {}) {
  let url = params.host + '/Api/v1/NonIncident/Search?LighthouseFunction=GetNITCJSONfromBeacon&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString();

  let s = '';
  if (typeof params.EntityIds !== 'undefined') {
    params.EntityIds.split(',').forEach((d) => {
      s += '&EntityIds%5B%5D=' + d;
    });
    url += s;
  }
  if (typeof params.NonIncidentTypeIds !== 'undefined') {
    params.NonIncidentTypeIds.split(',').forEach((d) => {
      s += '&NonIncidentTypeIds%5B%5D=' + d;
    });
    url += s;
  }
  if (typeof params.TagIds !== 'undefined') {
    params.TagIds.split(',').forEach((d) => {
      s += '&TagIds%5B%5D=' + d;
    });
    url += s;
  }
  if (typeof params.IncludeCompleted !== 'undefined') {
    url += '&IncludeCompleted=' + params.IncludeCompleted;
  }
  url += '&ViewModelType=6&SortField=Start&SortOrder=desc';

  const results = await requestPaginated(url, { token, pageSize: 100, ...opts });
  return { Results: results };
}
