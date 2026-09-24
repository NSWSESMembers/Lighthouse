import { request, toCollection } from './core/request.js';

/**
 * Contacts for a person.
 *
 * @param {string|number} personId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function search(personId, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return toCollection(
    await request(
      host + '/Api/v1/Contacts/Search?PersonIds%5B0%5D=' + personId + '&IncludeDeleted=false&PageIndex=1&PageSize=20&SortField=createdon&SortOrder=asc&LighthouseFunction=SearchContacts&userId=' + userId,
      { token, signal },
    ),
  );
}

/**
 * Free-text contact search (SMS recipients + contact groups only).
 *
 * @param {string} query
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export async function searchAll(query, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return toCollection(
    await request(
      host + '/Api/v1/Contacts/SearchAll?SearchTerm=' + encodeURIComponent(query) +
        '&RecipientTypes%5B0%5D=Contact%20Group' +
        '&ContactTypeIds%5B0%5D=2' +
        '&RecipientTypes%5B1%5D=Internal' +
        '&RecipientTypes%5B2%5D=External' +
        '&PageIndex=1&PageSize=20&LighthouseFunction=SearchContacts&userId=' + userId,
      { token, signal },
    ),
  );
}
