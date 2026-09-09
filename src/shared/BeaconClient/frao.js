import { requestPaginated } from './core/request.js';

/**
 * Flood Rescue Area Operations search.
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          onProgress?: Function, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function search(startDate, endDate, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, onProgress, onPage } = ctx;

  const params = new URLSearchParams({
    StatusStartDate: startDate.toISOString(),
    StatusEndDate: endDate.toISOString(),
    SortField: 'FRAONumber',
    SortOrder: 'desc',
  });

  const url = host + '/Api/v1/FloodRescueAreaOperations/Search?LighthouseFunction=GetJSONFRAO&userId=' + userId + '&' + params.toString();
  return requestPaginated(url, { token, signal, pageSize: 50, onProgress, onPage });
}
