import { request } from './core/request.js';

/**
 * Thumbnail metadata for an incident's images.
 *
 * @param {string|number} incidentId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object[]|null>}
 */
export function getIncidentImages(incidentId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(
    host + '/Api/v1/Image/IncidentThumbnails/' + incidentId + '?LighthouseFunction=getIncidentThumbnails&userId=' + userId,
    { token, signal },
  );
}

/**
 * Raw image bytes.
 *
 * @param {string|number} jobId
 * @param {string|number} imageId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<Blob>}
 */
export function getImageData(jobId, imageId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(
    host + '/Api/v1/Image/IncidentImage/' + jobId + '/' + imageId + '/?LighthouseFunction=getImageData&userId=' + userId,
    { token, signal, responseType: 'blob' },
  );
}
