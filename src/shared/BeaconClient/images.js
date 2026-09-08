import { request } from './core/request.js';

export function getIncidentImages(id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Image/IncidentThumbnails/' + id + '?LighthouseFunction=getIncidentThumbnails&userId=' + userId,
    { token },
  );
}

// Returns raw image data as a Blob.
export function getImageData(jobId, imageId, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Image/IncidentImage/' + jobId + '/' + imageId + '/?LighthouseFunction=getImageData&userId=' + userId,
    { token, responseType: 'blob' },
  );
}
