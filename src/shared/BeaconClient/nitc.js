import { requestPaginated } from './core/request.js';

/**
 * Non-Incident Task Card search.
 *
 * @param {object} filters  { EntityIds?, NonIncidentTypeIds?, TagIds?, IncludeCompleted? }
 *        (comma-separated id strings, as they arrive from the page URL)
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          onProgress?: Function, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function search(filters, startDate, endDate, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, onProgress, onPage } = ctx;

  let url = host + '/Api/v1/NonIncident/Search?LighthouseFunction=GetNITCJSONfromBeacon&userId=' + userId + '&StartDate=' + startDate.toISOString() + '&EndDate=' + endDate.toISOString();

  let s = '';
  if (typeof filters.EntityIds !== 'undefined') {
    filters.EntityIds.split(',').forEach((d) => {
      s += '&EntityIds%5B%5D=' + d;
    });
    url += s;
  }
  if (typeof filters.NonIncidentTypeIds !== 'undefined') {
    filters.NonIncidentTypeIds.split(',').forEach((d) => {
      s += '&NonIncidentTypeIds%5B%5D=' + d;
    });
    url += s;
  }
  if (typeof filters.TagIds !== 'undefined') {
    filters.TagIds.split(',').forEach((d) => {
      s += '&TagIds%5B%5D=' + d;
    });
    url += s;
  }
  if (typeof filters.IncludeCompleted !== 'undefined') {
    url += '&IncludeCompleted=' + filters.IncludeCompleted;
  }
  url += '&ViewModelType=6&SortField=Start&SortOrder=desc';

  return requestPaginated(url, { token, signal, pageSize: 100, onProgress, onPage });
}
