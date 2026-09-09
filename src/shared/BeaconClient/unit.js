import { request } from './core/request.js';

/**
 * @param {string|number} id  entity id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function getName(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Entities/' + id + '?LighthouseFunction=GetUnitNamefromBeacon&userId=' + userId, { token, signal });
}
