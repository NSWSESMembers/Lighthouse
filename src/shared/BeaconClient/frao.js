import { requestPaginated } from './core/request.js';

/**
 * Flood Rescue Area Operations search.
 *
 * @param {object} [opts]  { onProgress, onPage, signal } forwarded to requestPaginated
 * @returns {Promise<{Results: any[]}>}
 */
export async function search(StartDate, EndDate, host, userId = 'notPassed', token, opts = {}) {
  const params = new URLSearchParams({
    StatusStartDate: StartDate.toISOString(),
    StatusEndDate: EndDate.toISOString(),
    SortField: 'FRAONumber',
    SortOrder: 'desc',
  });

  const url = host + '/Api/v1/FloodRescueAreaOperations/Search?LighthouseFunction=GetJSONFRAO&userId=' + userId + '&' + params.toString();
  const results = await requestPaginated(url, { token, pageSize: 50, ...opts });
  return { Results: results };
}
