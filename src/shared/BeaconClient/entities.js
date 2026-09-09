import { request, toCollection } from './core/request.js';

/**
 * @param {string} query  entity name fragment (sent unencoded, as Beacon's own UI does)
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(query, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return toCollection(
    await request(host + '/Api/v1/Entities/Search?EntityName=' + query + '&LighthouseFunction=SearchEntitiesn&userId=' + userId, { token, signal }),
  );
}

/**
 * Direct child entities of `parentId`. Beacon returns a bare array here.
 *
 * @param {string|number} parentId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object[]>}
 */
export async function children(parentId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  const result = await request(
    host + '/Api/v1/Entities/' + parentId + '/Children/?LighthouseFunction=EntitiesChildren&userId=' + userId,
    { token, signal },
  );
  return result || [];
}

/**
 * A single entity by id.
 *
 * @param {string|number} id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function get(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Entities/' + id + '?LighthouseFunction=EntitiesFetch&userId=' + userId, { token, signal });
}
