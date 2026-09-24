import { request, requestPaginated } from './core/request.js';

/**
 * Job search over a date range.
 *
 * @param {object|Array|null} unit  a single entity ({Id}), an array of entities, or null for "all"
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          onProgress?: Function, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function search(unit, startDate, endDate, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, onProgress, onPage } = ctx;
  const viewModel = '6';
  let url;

  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) === false) {
      url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&StartDate=' + startDate.toISOString() + '&EndDate=' + endDate.toISOString() + '&Hq=' + unit.Id + '&ViewModelType=' + viewModel + '&SortField=Id&SortOrder=desc';
    } else {
      let hqString = '';
      unit.forEach((d) => {
        hqString = hqString + '&Hq=' + d.Id;
      });
      url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&StartDate=' + startDate.toISOString() + '&EndDate=' + endDate.toISOString() + hqString + '&ViewModelType=' + viewModel + '&SortField=Id&SortOrder=desc';
    }
  } else {
    url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&StartDate=' + startDate.toISOString() + '&EndDate=' + endDate.toISOString() + '&ViewModelType=' + viewModel + '&SortField=Id&SortOrder=desc';
  }

  return requestPaginated(url, { token, signal, pageSize: 100, onProgress, onPage });
}

/**
 * Job search from a raw pre-built query string.
 *
 * @param {string} rawQuery  everything after `Search?LighthouseFunction=...&userId=...&`
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          onProgress?: Function, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function searchRaw(rawQuery, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, onProgress, onPage } = ctx;
  const url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&' + rawQuery;
  return requestPaginated(url, { token, signal, pageSize: 50, onProgress, onPage });
}

/**
 * Jobs summary report.
 *
 * @param {object|Array|null} unit
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object>}
 */
export function summary(unit, startDate, endDate, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  let url;
  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) === false) {
      url = host + '/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=' + userId + '&StartDate=' + startDate.toISOString() + '&EndDate=' + endDate.toISOString() + '&EntityIds=' + unit.Id;
    } else {
      let hqString = '';
      unit.forEach((d) => {
        hqString = hqString + '&EntityIds=' + d.Id;
      });
      url = host + '/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=' + userId + '&StartDate=' + startDate.toISOString() + '&EndDate=' + endDate.toISOString() + hqString;
    }
  } else {
    url = host + '/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=' + userId + '&StartDate=' + startDate.toISOString() + '&EndDate=' + endDate.toISOString();
  }
  return request(url, { token, signal });
}

/**
 * A single job.
 *
 * @param {string|number} id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal, viewModelType?: number}} ctx
 * @returns {Promise<object|null>}
 */
export function get(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, viewModelType = 1 } = ctx;
  return request(
    host + '/Api/v1/Jobs/' + id + '?LighthouseFunction=GetJobfromBeacon&userId=' + userId + '&viewModelType=' + viewModelType,
    { token, signal },
  );
}

/**
 * Tasking for one job id or a batch of them.
 *
 * @param {string|number|Array} ids
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal,
 *          onProgress?: Function, onPage?: Function}} ctx
 * @returns {Promise<{results: object[], totalItems: number}>}
 */
export function getTasking(ids, ctx = {}) {
  const { host, userId = 'notPassed', token, signal, onProgress, onPage } = ctx;
  const idArr = Array.isArray(ids) ? ids : [ids];
  const fnName = Array.isArray(ids) ? 'GetBulkJobTaskingFromBeacon' : 'GetJobTaskingFromBeacon';
  const jobIdsParam = idArr.map((jid) => 'JobIds%5B%5D=' + encodeURIComponent(jid)).join('&');
  const url = host + '/Api/v1/Tasking/Search?LighthouseFunction=' + fnName + '&userId=' + userId + '&' + jobIdsParam;
  return requestPaginated(url, { token, signal, pageSize: 100, onProgress, onPage });
}

/**
 * Job status history.
 *
 * @param {string|number} id
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<object[]|null>}
 */
export function getHistory(id, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + '/Api/v1/Jobs/' + id + '/History/?LighthouseFunction=getHistory&userId=' + userId, { token, signal });
}

function jobAction(url, ctx, body) {
  const { token, signal } = ctx;
  return request(url, { method: 'POST', token, signal, json: body, responseType: 'none' });
}

/**
 * @param {string|number} jobId
 * @param {string} text
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<void>}  resolves on success, rejects on failure
 */
export function cancel(jobId, text, ctx = {}) {
  return jobAction(ctx.host + `/Api/v1/Jobs/${jobId}/Cancel?LighthouseFunction=JobCancel&userId=` + (ctx.userId ?? 'notPassed'), ctx, {
    Text: text,
    Date: new Date().toISOString(),
  });
}

/**
 * @param {string|number} jobId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<void>}
 */
export function reopen(jobId, ctx = {}) {
  return jobAction(ctx.host + `/Api/v1/Jobs/${jobId}/Reopen?LighthouseFunction=JobReopen&userId=` + (ctx.userId ?? 'notPassed'), ctx);
}

/**
 * @param {string|number} jobId
 * @param {string} text
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<void>}
 */
export function reject(jobId, text, ctx = {}) {
  return jobAction(ctx.host + `/Api/v1/Jobs/${jobId}/Reject?LighthouseFunction=JobReject&userId=` + (ctx.userId ?? 'notPassed'), ctx, {
    Text: text,
    Date: new Date().toISOString(),
  });
}

/**
 * @param {string|number} jobId
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<void>}
 */
export function acknowledge(jobId, ctx = {}) {
  return jobAction(ctx.host + `/Api/v1/Jobs/${jobId}/Acknowledge?LighthouseFunction=JobAcknowledge&userId=` + (ctx.userId ?? 'notPassed'), ctx);
}

/**
 * @param {string|number} jobId
 * @param {string} text
 * @param {{host: string, userId?: string, token: string, signal?: AbortSignal}} ctx
 * @returns {Promise<void>}
 */
export function complete(jobId, text, ctx = {}) {
  const { host, userId = 'notPassed', token, signal } = ctx;
  return request(host + `/Api/v1/Jobs/${jobId}/Complete?LighthouseFunction=JobComplete&userId=` + userId, {
    method: 'POST',
    token,
    signal,
    form: `Text=${encodeURIComponent(text)}&Date=${encodeURIComponent(new Date().toISOString())}`,
    responseType: 'none',
  });
}
