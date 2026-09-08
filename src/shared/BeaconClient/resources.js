import { request } from './core/request.js';

export function get(id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Entities/' + id + '?LighthouseFunction=GetResourcesfromBeacon&userId=' + userId,
    { token },
  );
}
