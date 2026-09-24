/*
  Core HTTP layer for the Beacon REST API.

  Every module under BeaconClient/ goes through request() or
  requestPaginated(): one place for the Bearer header, JSON handling, error
  semantics and Beacon's paged-search loop. All helpers return Promises and
  reject with a BeaconApiError on a non-2xx response.
*/

export class BeaconApiError extends Error {
  constructor(status, statusText, url, body) {
    super(`Beacon API ${status} ${statusText || ''}`.trim() + ` (${url})`);
    this.name = 'BeaconApiError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.body = body;
  }
}

/**
 * Serialise a plain object to application/x-www-form-urlencoded.
 * Array values are emitted as `key[]=a&key[]=b`; null/undefined become "".
 *
 * @param {Record<string, unknown>} obj
 * @returns {string}
 */
export function toFormUrlEncoded(obj) {
  const params = [];
  for (const key in obj) {
    const value = obj[key];
    if (Array.isArray(value)) {
      value.forEach((v) => params.push(encodeURIComponent(key + '[]') + '=' + encodeURIComponent(v)));
    } else {
      params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value ?? ''));
    }
  }
  return params.join('&');
}

/**
 * Normalise a Beacon collection payload (`{ Results, TotalItems }`) to the
 * `{ results, totalItems }` shape every BeaconClient search returns. Tolerates
 * a bare array or a null/empty body.
 *
 * @param {any} payload
 * @returns {{results: any[], totalItems: number}}
 */
export function toCollection(payload) {
  if (Array.isArray(payload)) {
    return { results: payload, totalItems: payload.length };
  }
  const results = (payload && payload.Results) || [];
  return { results, totalItems: (payload && payload.TotalItems) || results.length };
}

/**
 * Make a single request to the Beacon API.
 *
 * @param {string} url  fully-qualified request URL
 * @param {object} [opts]
 * @param {string} [opts.method='GET']
 * @param {string} [opts.token]  bearer token; sent as `Authorization: Bearer <token>`
 * @param {unknown} [opts.json]  body, serialised as application/json
 * @param {Record<string, unknown>|string} [opts.form]  body, serialised as
 *        x-www-form-urlencoded (a string is sent verbatim)
 * @param {'json'|'blob'|'text'|'none'} [opts.responseType='json']
 * @param {Record<string, string>} [opts.headers]
 * @param {AbortSignal} [opts.signal]
 * @param {boolean} [opts.nullOnError=false]  resolve with null instead of
 *        rejecting on a non-2xx response. Only for the handful of Beacon POST
 *        endpoints that spuriously return 500 on an otherwise-successful write
 *        (tasking, job messages) where the caller re-syncs state anyway.
 * @param {RequestCredentials} [opts.credentials='omit']  cookie handling. The
 *        Beacon API authenticates on the `Authorization: Bearer` header only;
 *        we never want cookies. Chrome attaches a host's cookies to `fetch`
 *        from an extension context whose manifest grants that host, even under
 *        the spec default `same-origin`, and a stale/foreign Beacon session
 *        cookie riding along makes the API 401 the request despite a valid
 *        bearer. `omit` matches how the old jQuery cross-origin XHR behaved.
 * @returns {Promise<any>}  parsed body (or Blob/text/null per responseType)
 */
export async function request(url, opts = {}) {
  const {
    method = 'GET', token, json, form, responseType = 'json', headers = {}, signal,
    nullOnError = false, credentials = 'omit',
  } = opts;

  const finalHeaders = { ...headers };
  if (token) {
    finalHeaders.Authorization = 'Bearer ' + token;
  }

  let body;
  if (form !== undefined) {
    finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
    body = typeof form === 'string' ? form : toFormUrlEncoded(form);
  } else if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json; charset=utf-8';
    body = JSON.stringify(json);
  }

  const response = await fetch(url, { method, headers: finalHeaders, body, cache: 'no-store', credentials, signal });

  if (!response.ok) {
    let errorBody = null;
    try {
      errorBody = await response.text();
    } catch (_) {
      /* body already consumed or unavailable */
    }
    if (nullOnError) {
      console.warn(`Beacon API ${response.status} ${response.statusText || ''} (${url}) -- swallowed (nullOnError)`);
      return null;
    }
    throw new BeaconApiError(response.status, response.statusText, url, errorBody);
  }

  if (responseType === 'none' || response.status === 204) {
    return null;
  }
  if (responseType === 'blob') {
    return response.blob();
  }
  if (responseType === 'text') {
    return response.text();
  }

  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_) {
    // Beacon occasionally 200s with a non-JSON body (e.g. a bare id); hand it back raw.
    return text;
  }
}

/**
 * Run one of Beacon's paged Search endpoints to completion, appending
 * `PageIndex`/`PageSize` per page and concatenating every page's `Results`.
 *
 * @param {string} url  search URL *without* paging params
 * @param {object} [opts]
 * @param {string} [opts.token]
 * @param {number} [opts.pageLimit=0]  stop after this many pages (0 = until exhausted)
 * @param {number} [opts.pageSize=100]  rows requested per page
 * @param {(collected: number, total: number) => void} [opts.onProgress]
 * @param {(page: {results: any[], totalItems: number}) => void} [opts.onPage]  each page as it arrives
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{results: any[], totalItems: number}>}  all rows across every page
 */
export async function requestPaginated(url, opts = {}) {
  const { token, pageLimit = 0, pageSize = 100, onProgress, onPage, signal } = opts;
  const separator = url.includes('?') ? '&' : '?';
  const results = [];
  let totalItems = 0;
  let page = 1;

  for (;;) {
    const pageResult = await request(`${url}${separator}PageIndex=${page}&PageSize=${pageSize}`, { token, signal });

    const rows = (pageResult && pageResult.Results) || [];
    totalItems = (pageResult && pageResult.TotalItems) || 0;
    results.push(...rows);

    if (typeof onPage === 'function') {
      onPage({ results: rows, totalItems });
    }
    if (typeof onProgress === 'function') {
      onProgress(results.length, totalItems);
    }

    if (rows.length === 0) break;
    if (pageLimit && page >= pageLimit) break;
    if (results.length >= totalItems) break;
    page++;
  }

  return { results, totalItems };
}
