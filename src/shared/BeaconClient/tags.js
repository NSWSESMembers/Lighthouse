import { request } from './core/request.js';

/**
 * All tags in a group. No paging -- assumes a group never holds more than 1000 tags.
 *
 * @param {string|number} groupId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object[]>}
 */
export async function getGroup(groupId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  const result = await request(
    host + '/Api/v1/Tags/Group/' + groupId + '?pageIndex=1&pageSize=1000&LighthouseFunction=getGroup&userId=' + userId,
    { token, signal },
  );
  return (result && result.Results) || [];
}
