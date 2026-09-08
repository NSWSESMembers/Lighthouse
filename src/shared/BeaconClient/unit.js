import { request } from './core/request.js';

export function getName(id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Entities/' + id + '?LighthouseFunction=GetUnitNamefromBeacon&userId=' + userId,
    { token },
  );
}
