import { request, toCollection } from './core/request.js';

/**
 * Builds the FirstName/LastName/Username/Email query params for a single
 * free-text search box. A query containing a space is unambiguously a
 * "firstname lastname" search (nobody's Username or Email has a space in
 * it), so it's split -- everything before the last word as FirstName,
 * the last word as LastName -- rather than sent as one blob to every field,
 * which would rarely match anything. A single word (a name, member number,
 * or partial email) is still sent against all four fields simultaneously
 * (mirroring how Beacon's own admin UI searches this endpoint) so callers
 * don't need to guess which kind of value the user typed.
 */
function buildSearchParams(query) {
  const trimmed = String(query || '').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    const lastName = words[words.length - 1];
    const firstName = words.slice(0, -1).join(' ');
    return 'FirstName=' + encodeURIComponent(firstName) + '&LastName=' + encodeURIComponent(lastName);
  }

  return 'FirstName=' + encodeURIComponent(trimmed) +
    '&LastName=' + encodeURIComponent(trimmed) +
    '&Username=' + encodeURIComponent(trimmed) +
    '&Email=' + encodeURIComponent(trimmed);
}

/**
 * @param {string} query
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(query, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return toCollection(
    await request(
      host + '/Api/v1/Users/Search?' + buildSearchParams(query) +
        '&External=false&IsDeleted=false&PageIndex=1&PageSize=10' +
        '&LighthouseFunction=SearchUsers&userId=' + userId,
      { token, signal },
    ),
  );
}
