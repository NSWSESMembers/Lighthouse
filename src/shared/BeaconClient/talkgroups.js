import { request, toCollection } from './core/request.js';

/**
 * Talkgroup name-search, for resolving an OpsLog entry's TalkgroupId.
 *
 * Confirmed against Beacon: `TalkgroupName` filters (a search for "dispatch" returns only the Dispatch
 * talkgroups, nonsense returns none). A bare `Name` is silently ignored and returns every talkgroup (136).
 * Each result has Id, Name, Description, Zone, Channel and Entity.
 *
 * @param {string} query
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(query, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return toCollection(
    await request(
      host + '/Api/v1/Talkgroups/Search?TalkgroupName=' + encodeURIComponent(query) + '&LighthouseFunction=SearchTalkgroups&userId=' + userId,
      { token, signal },
    ),
  );
}
