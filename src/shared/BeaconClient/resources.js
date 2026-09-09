import { request } from './core/request.js';

/**
 * @param {string|number} id  entity id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function get(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Entities/' + id + '?LighthouseFunction=GetResourcesfromBeacon&userId=' + userId, { token, signal });
}
