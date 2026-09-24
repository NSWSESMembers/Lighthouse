import { request } from './core/request.js';

/**
 * @param {string|number} jobId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function get(jobId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Suppliers/Job/' + jobId + '?LighthouseFunction=suppliersGet&userId=' + userId, { token, signal });
}
