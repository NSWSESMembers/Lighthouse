import { request } from './core/request.js';

/**
 * @param {string|number} personId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function getSimplePerson(personId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(
    host + '/Api/v1/People/GetSimplePerson/' + encodeURIComponent(personId) + '?LighthouseFunction=GetSimplePerson&userId=' + userId,
    { token, signal },
  );
}
