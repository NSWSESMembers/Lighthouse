import { request } from './core/request.js';

export function getSimplePerson(personId, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/People/GetSimplePerson/' + encodeURIComponent(personId) + '?LighthouseFunction=GetSimplePerson&userId=' + userId,
    { token },
  );
}
