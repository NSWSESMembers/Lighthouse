import { requestPaginated, request } from './core/request.js';

/**
 * Active sectors for the given HQ(s).
 *
 * @param {object|Array|null} unit  a single entity ({Id}), an array of entity ids, or null for "all"
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          onProgress?: Function, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(unit, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, onProgress, onPage } = ctx;

  let url;
  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) === false) {
      url = host + '/Api/v1/Sectors/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&Statusids=1&EntityIds=' + unit.Id + '&SortField=Id&SortOrder=desc';
    } else {
      let hqString = '';
      unit.forEach((d) => {
        hqString = hqString + '&EntityIds=' + d;
      });
      url = host + '/Api/v1/Sectors/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + hqString + '&Statusids=1&SortField=Id&SortOrder=desc';
    }
  } else {
    url = host + '/Api/v1/Sectors/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&Statusids=1&SortField=Id&SortOrder=desc';
  }

  return requestPaginated(url, { token, signal, pageSize: 300, onProgress, onPage });
}

/**
 * @param {string|number} jobId
 * @param {string|number} sectorId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}
 */
export function setSector(jobId, sectorId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Sectors/' + sectorId + '/Jobs?LighthouseFunction=SetSectorForJob', {
    method: 'PUT',
    token,
    signal,
    json: { IdsToAdd: [jobId], userId },
  });
}

/**
 * @param {string|number} jobId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}
 */
export function unSetSector(jobId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Sectors/RemoveJobFromSector/' + jobId + '?LighthouseFunction=unSetSectorForJob', {
    method: 'PUT',
    token,
    signal,
    json: { userId },
  });
}
