import { request, requestPaginated } from './core/request.js';

/**
 * @param {object|Array|null} unit  a single entity ({Id}), an array of entity ids, or null for "all"
 * @param {object} [opts]  { onProgress, onPage, signal } forwarded to requestPaginated
 * @returns {Promise<{Results: any[]}>}
 */
export async function search(unit, host, userId = 'notPassed', token, opts = {}) {
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

  const results = await requestPaginated(url, { token, pageSize: 300, ...opts });
  return { Results: results };
}

export function setSector(jobId, sectorId, host, userId, token) {
  return request(host + '/Api/v1/Sectors/' + sectorId + '/Jobs?LighthouseFunction=SetSectorForJob', {
    method: 'PUT',
    token,
    json: { IdsToAdd: [jobId], userId },
  });
}

export function unSetSector(jobId, host, userId, token) {
  return request(host + '/Api/v1/Sectors/RemoveJobFromSector/' + jobId + '?LighthouseFunction=unSetSectorForJob', {
    method: 'PUT',
    token,
    json: { userId },
  });
}
