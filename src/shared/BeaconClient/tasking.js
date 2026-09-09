import { request } from './core/request.js';

// The POST/PUT/DELETE tasking endpoints intermittently return 500 despite
// applying the change; callers re-sync from SignalR, so a failed response is
// swallowed (nullOnError -> resolve null) rather than thrown.

/**
 * Task a team to a job.
 *
 * @param {string|number} teamId
 * @param {string|number} jobId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}  response body, or null on failure
 */
export function task(teamId, jobId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Tasking', {
    method: 'POST',
    token,
    signal,
    json: { TeamIds: [teamId], JobIds: [jobId], LighthouseFunction: 'client.TaskTeam', userId },
    nullOnError: true,
  });
}

/**
 * @param {string|number} taskingId
 * @param {string} status  status path segment (e.g. "OnRoute")
 * @param {Record<string, unknown>} payload
 * @param {{host: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}  response body, or null on failure
 */
export function updateTeamStatus(taskingId, status, payload, ctx = {}) {
  const { host, token, signal } = ctx;
  return request(host + '/Api/v1/Tasking/' + taskingId + '/' + status, {
    method: 'POST',
    token,
    signal,
    json: payload,
    nullOnError: true,
  });
}

/**
 * @param {string|number} taskingId
 * @param {Record<string, unknown>} payload
 * @param {{host: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}  response body, or null on failure
 */
export function callOffTeam(taskingId, payload, ctx = {}) {
  const { host, token, signal } = ctx;
  return request(host + '/Api/v1/Tasking/' + taskingId + '/Calloff', {
    method: 'PUT',
    token,
    signal,
    json: payload,
    nullOnError: true,
  });
}

/**
 * @param {string|number} taskingId
 * @param {Record<string, unknown>|string} payload  form fields (or a pre-encoded string)
 * @param {{host: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<any>}  response body, or null on failure
 */
export function untaskTeam(taskingId, payload, ctx = {}) {
  const { host, token, signal } = ctx;
  return request(host + '/Api/v1/Tasking/' + taskingId, {
    method: 'DELETE',
    token,
    signal,
    form: payload,
    nullOnError: true,
  });
}

/**
 * Reorder taskings.
 *
 * @param {object} sequenceBody  { Sequences: [...] }
 * @param {{host: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<void>}  resolves on success, rejects on failure
 */
export function sequence(sequenceBody, ctx = {}) {
  const { host, token, signal } = ctx;
  return request(host + '/Api/v1/Tasking/Sequences', {
    method: 'PUT',
    token,
    signal,
    json: sequenceBody,
    responseType: 'none',
  });
}
