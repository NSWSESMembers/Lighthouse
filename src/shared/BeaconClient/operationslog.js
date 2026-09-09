import { request, toCollection } from './core/request.js';

/**
 * Ops Log entries for a job. Limited to 1000 entries; no paging.
 *
 * @param {string|number} jobId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(jobId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return toCollection(
    await request(
      host + '/Api/v1/OperationsLog/search?LighthouseFunction=GetOperationsLogfromBeacon&userId=' + userId + '&JobIds%5B%5D=' + jobId + '&PageIndex=1&PageSize=1000&SortOrder=desc&SortField=TimeLogged',
      { token, signal },
    ),
  );
}

/**
 * A single Ops Log entry.
 *
 * @param {string|number} entryId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object|null>}
 */
export function get(entryId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(
    host + '/Api/v1/OperationsLog/' + entryId + '?LighthouseFunction=GetOperationsLogEntryfromBeacon&userId=' + userId,
    { token, signal },
  );
}

/**
 * @param {Record<string, unknown>|string} payload  form fields (or a pre-encoded string)
 * @param {{host: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}  the created entry
 */
export function create(payload, ctx = {}) {
  const { host, token, signal } = ctx;
  return request(host + '/Api/v1/OperationsLog', { method: 'POST', token, signal, form: payload });
}

/**
 * Unresolved "action required" Ops Log entries for a job.
 *
 * @param {object} job  a Job view-model ({ id(), jobReceived() })
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function unresolvedActionsLog(job, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  const queryParams = new URLSearchParams({
    DateFrom: new Date(job.jobReceived()).toISOString(),
    DateTo: new Date().toISOString(),
    'JobIds[0]': job.id(),
    ExcludeJobEntries: 'false',
    ExcludeIcemsEntries: 'true',
    UnresolvedActionsOnly: 'true',
    'TagIds[0]': 286,
    'TagIds[1]': 423,
    'TagIds[2]': 285,
    'TagIds[3]': 506,
    'TagIds[4]': 288,
    'TagIds[5]': 290,
    'TagIds[6]': 289,
    'TagIds[7]': 551,
    'TagIds[8]': 291,
    'TagIds[9]': 307,
    'TagIds[10]': 292,
    'TagIds[11]': 424,
    'TagIds[12]': 422,
    'TagIds[13]': 287,
    PageIndex: 1,
    PageSize: 100,
    SortField: 'TimeLogged',
    SortOrder: 'desc',
    LighthouseFunction: 'GetOperationsLogUnresolvedActions',
    userId: userId,
  });

  return toCollection(await request(`${host}/Api/v1/OperationsLog/search?${queryParams.toString()}`, { token, signal }));
}
