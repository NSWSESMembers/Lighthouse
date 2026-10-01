import { request, requestPaginated, toCollection } from './core/request.js';

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
 * Resolve an "action required" Ops Log entry.
 *
 * @param {string|number} entryId
 * @param {Record<string, unknown>|string} resolution  resolution text, or a
 *        payload of form fields (Text, FurtherActionRequired, ActionReminder)
 * @param {{host: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}  the updated entry
 */
export function resolve(entryId, resolution, ctx = {}) {
  const { host, token, signal } = ctx;
  const fields = typeof resolution === 'string' ? { Text: resolution } : resolution;
  return request(host + '/Api/v1/OperationsLog/' + entryId + '/Resolve', {
    method: 'PUT',
    token,
    signal,
    form: { Id: entryId, FurtherActionRequired: false, ActionReminder: '', ...fields },
  });
}

/**
 * Ops Log entries scoped to an HQ/unit and a time window, for the Radio
 * Operations Console's live log view -- as opposed to `search()`, which is
 * job-scoped only.
 *
 * `EntityIds[N]`, `DateFrom` and `DateTo` match the request Beacon's own Operations Log page sends.
 * That page also sends ExcludeJobEntries / ExcludeIcemsEntries / UnresolvedActionsOnly (all false) and
 * sorts by CreatedOn; we leave those at their defaults and sort by TimeLogged so back-dated entries land
 * in the right place.
 *
 * @param {object} filters
 * @param {Array<string|number>} [filters.entityIds]  HQ/unit scope
 * @param {Date} [filters.dateFrom]
 * @param {Date} [filters.dateTo]
 * @param {Array<string|number>} [filters.jobIds]  incident/job association filter
 * @param {Array<string|number>} [filters.eventIds]  event association filter
 * @param {Array<string|number>} [filters.tagIds]  tag filter -- `TagIds[N]` is confirmed
 *        against this same endpoint (matches any of the given tags)
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          pageSize?: number, pageLimit?: number, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function searchLog(filters = {}, ctx = {}) {
  const { entityIds = [], dateFrom, dateTo, jobIds = [], eventIds = [], tagIds = [] } = filters;
  const { host, userId = 'notPassed', token, signal, pageSize = 100, pageLimit = 0, onPage } = ctx;

  const params = new URLSearchParams();
  entityIds.forEach((id, i) => params.set(`EntityIds[${i}]`, id));
  jobIds.forEach((id, i) => params.set(`JobIds[${i}]`, id));
  eventIds.forEach((id, i) => params.set(`EventIds[${i}]`, id));
  tagIds.forEach((id, i) => params.set(`TagIds[${i}]`, id));
  if (dateFrom) params.set('DateFrom', dateFrom.toISOString());
  if (dateTo) params.set('DateTo', dateTo.toISOString());
  params.set('SortField', 'TimeLogged');
  params.set('SortOrder', 'desc');
  params.set('LighthouseFunction', 'GetOperationsLogfromBeacon');
  params.set('userId', userId);

  const url = `${host}/Api/v1/OperationsLog/search?${params.toString()}`;
  return requestPaginated(url, { token, signal, pageSize, pageLimit, onPage });
}

// Beacon's IIS front end rejects query strings over 4096 chars -- with a 404,
// not a 413 -- so batched JobIds searches are split to stay under this.
const MAX_QUERY_LENGTH = 3800;

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
    PageIndex: 1,
    PageSize: 100,
    SortField: 'TimeLogged',
    SortOrder: 'desc',
    LighthouseFunction: 'GetOperationsLogUnresolvedActions',
    userId: userId,
  });

  return toCollection(await request(`${host}/Api/v1/OperationsLog/search?${queryParams.toString()}`, { token, signal }));
}

/**
 * Unresolved "action required" Ops Log entries for many jobs at once -- the
 * batched form of unresolvedActionsLog(). Every entry carries its `JobId`, so
 * callers group the results per job.
 *
 * No TagIds filter: UnresolvedActionsOnly alone returns every entry still
 * flagged ActionRequired, and the Job model keeps only TagGroupId 27 tags.
 *
 * JobIds use the repeated-key form (`JobIds=1&JobIds=2`) rather than
 * `JobIds[N]` to fit more jobs per request; the ids are split into as many
 * requests as needed to keep each query string under MAX_QUERY_LENGTH (about
 * 240 jobs per request), and every page of each is fetched.
 *
 * @param {Array<string|number>} jobIds
 * @param {Date} dateFrom  must be on/before the oldest job's received time
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function unresolvedActionsForJobs(jobIds, dateFrom, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  if (!jobIds.length) return { results: [], totalItems: 0 };

  const params = new URLSearchParams({
    DateFrom: dateFrom.toISOString(),
    DateTo: new Date().toISOString(),
    ExcludeJobEntries: 'false',
    ExcludeIcemsEntries: 'true',
    UnresolvedActionsOnly: 'true',
    SortField: 'TimeLogged',
    SortOrder: 'desc',
    LighthouseFunction: 'GetOperationsLogUnresolvedActions',
    userId: userId,
  });
  // requestPaginated appends `&PageIndex=N&PageSize=100` to each request.
  const fixedLength = params.toString().length + '&PageIndex=9999&PageSize=100'.length;

  const batches = [];
  let batch = [];
  let length = fixedLength;
  for (const id of jobIds) {
    const part = `JobIds=${encodeURIComponent(id)}&`;
    if (batch.length && length + part.length > MAX_QUERY_LENGTH) {
      batches.push(batch);
      batch = [];
      length = fixedLength;
    }
    batch.push(part);
    length += part.length;
  }
  batches.push(batch);

  const pages = await Promise.all(
    batches.map((parts) =>
      requestPaginated(`${host}/Api/v1/OperationsLog/search?${parts.join('')}${params.toString()}`, { token, signal }),
    ),
  );
  const results = pages.flatMap((p) => p.results);
  return { results, totalItems: results.length };
}
