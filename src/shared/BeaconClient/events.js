import { request, toCollection } from './core/request.js';

/**
 * A single free-text `query` is sent against both EventName and Identifier
 * simultaneously (same "OR across fields" shape as Users/Search) so callers
 * don't need to guess whether the user typed an event name or its
 * identifier (e.g. "6/1718"). ViewModelType=2 mirrors Beacon's own event
 * picker requests.
 *
 * @param {string} query
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(query, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return toCollection(
    await request(
      host + '/Api/v1/Events/Search?EventName=' + encodeURIComponent(query) +
        '&Identifier=' + encodeURIComponent(query) +
        '&ViewModelType=2&PageSize=10&SortField=identifier&SortOrder=asc' +
        '&LighthouseFunction=SearchEvents&userId=' + userId,
      { token, signal },
    ),
  );
}

/**
 * The most recently created events, newest first (highest Id), optionally
 * limited to those affecting the given entities/HQs. Beacon's Events page filters with
 * `AffectedEntityIds[]` (plain `EntityIds` is accepted but silently ignored). If the filtered
 * request is rejected, callers can fall back to the unfiltered one.
 *
 * @param {Array<string|number>} entityIds  empty for no HQ filter
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @param {{limit?: number}} [options]
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function recent(entityIds, ctx = {}, { limit = 5 } = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  const entityParams = (entityIds || []).map((id) => '&AffectedEntityIds%5B%5D=' + encodeURIComponent(id)).join('');
  return toCollection(
    await request(
      host + '/Api/v1/Events/Search?ViewModelType=2&PageSize=' + limit + '&SortField=Id&SortOrder=desc' + entityParams +
        '&LighthouseFunction=RecentEvents&userId=' + userId,
      { token, signal },
    ),
  );
}
