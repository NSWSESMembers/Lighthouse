import { request, requestPaginated } from './core/request.js';

/**
 * @param {object|Array|null} unit  a single entity ({Id}), an array of entities, or null for "all"
 * @param {object} [opts]  { onProgress, onPage, signal } forwarded to requestPaginated
 * @returns {Promise<{Results: any[]}>}
 */
export async function search(unit, host, StartDate, EndDate, userId = 'notPassed', token, opts = {}) {
  const viewmodel = '6';
  let url;

  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) === false) {
      url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + '&Hq=' + unit.Id + '&ViewModelType=' + viewmodel + '&SortField=Id&SortOrder=desc';
    } else {
      let hqString = '';
      unit.forEach((d) => {
        hqString = hqString + '&Hq=' + d.Id;
      });
      url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + hqString + '&ViewModelType=' + viewmodel + '&SortField=Id&SortOrder=desc';
    }
  } else {
    url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + '&ViewModelType=' + viewmodel + '&SortField=Id&SortOrder=desc';
  }

  const results = await requestPaginated(url, { token, pageSize: 100, ...opts });
  return { Results: results };
}

/**
 * @param {object} [opts]  { onProgress, onPage, signal } forwarded to requestPaginated
 * @returns {Promise<{Results: any[]}>}
 */
export async function searchRaw(rawURL, host, userId = 'notPassed', token, opts = {}) {
  const url = host + '/Api/v1/Jobs/Search?LighthouseFunction=GetJSONfromBeacon&userId=' + userId + '&' + rawURL;
  const results = await requestPaginated(url, { token, pageSize: 50, ...opts });
  return { Results: results };
}

export function summary(unit, host, StartDate, EndDate, userId = 'notPassed', token) {
  let url;
  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) === false) {
      url = host + '/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + '&EntityIds=' + unit.Id;
    } else {
      let hqString = '';
      unit.forEach((d) => {
        hqString = hqString + '&EntityIds=' + d.Id;
      });
      url = host + '/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + hqString;
    }
  } else {
    url = host + '/Api/v1/Reports/JobsSummary?LighthouseFunction=GetSummaryJSONfromBeacon&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString();
  }

  return request(url, { token });
}

export function get(id, viewModelType = 1, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Jobs/' + id + '?LighthouseFunction=GetJobfromBeacon&userId=' + userId + '&viewModelType=' + viewModelType,
    { token },
  );
}

/**
 * @param {string|number|Array} ids  a single job id or an array of job ids
 * @param {object} [opts]  { onProgress, onPage, signal } forwarded to requestPaginated
 * @returns {Promise<{Results: any[]}>}
 */
export async function getTasking(ids, host, userId = 'notPassed', token, opts = {}) {
  const idArr = Array.isArray(ids) ? ids : [ids];
  const fnName = Array.isArray(ids) ? 'GetBulkJobTaskingFromBeacon' : 'GetJobTaskingFromBeacon';
  const jobIdsParam = idArr.map((jid) => 'JobIds%5B%5D=' + encodeURIComponent(jid)).join('&');
  const url = host + '/Api/v1/Tasking/Search?LighthouseFunction=' + fnName + '&userId=' + userId + '&' + jobIdsParam;
  const results = await requestPaginated(url, { token, pageSize: 100, ...opts });
  return { Results: results };
}

/**
 * @param {object} [opts]  { onProgress, onPage, signal } forwarded to requestPaginated
 * @returns {Promise<{Results: any[]}>}
 */
export async function searchwithFilter(unit, host, StartDate, EndDate, userId = 'notPassed', token, viewmodel, statusTypes = [], jobType = [], opts = {}) {
  if (typeof viewmodel === 'undefined') {
    viewmodel = '6';
  }

  let statusString = '';
  statusTypes.forEach((s) => {
    statusString = statusString + '&JobStatusTypeIds=' + s;
  });
  let jobString = '';
  jobType.forEach((j) => {
    jobString = jobString + '&JobTypeIds=' + j;
  });

  let url;
  if (unit !== null || typeof unit === 'undefined') {
    if (Array.isArray(unit) === false) {
      url = host + '/Api/v1/Jobs/Search?LighthouseFunction=searchwithFilter&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + '&Hq=' + unit.Id + '&ViewModelType=' + viewmodel + '&SortField=Id&SortOrder=desc';
    } else {
      let hqString = '';
      unit.forEach((d) => {
        hqString = hqString + '&Hq=' + d.Id;
      });
      url = host + '/Api/v1/Jobs/Search?LighthouseFunction=searchwithFilter&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + hqString + statusString + jobString + '&ViewModelType=' + viewmodel + '&SortField=Id&SortOrder=desc';
    }
  } else {
    url = host + '/Api/v1/Jobs/Search?LighthouseFunction=searchwithFilter&userId=' + userId + '&StartDate=' + StartDate.toISOString() + '&EndDate=' + EndDate.toISOString() + statusString + jobString + '&ViewModelType=' + viewmodel + '&SortField=Id&SortOrder=desc';
  }

  const results = await requestPaginated(url, { token, pageSize: 50, ...opts });
  return { Results: results };
}

export function getHistory(id, host, userId = 'notPassed', token) {
  return request(
    host + '/Api/v1/Jobs/' + id + '/History/?LighthouseFunction=getHistory&userId=' + userId,
    { token },
  );
}

async function jobAction(url, token, body) {
  try {
    await request(url, { method: 'POST', token, json: body, responseType: 'none' });
    return true;
  } catch (_) {
    return false;
  }
}

export function cancel(jobId, text, host, userId = 'notPassed', token) {
  return jobAction(host + `/Api/v1/Jobs/${jobId}/Cancel?LighthouseFunction=JobCancel&userId=` + userId, token, {
    Text: text,
    Date: new Date().toISOString(),
  });
}

export function reopen(jobId, host, userId = 'notPassed', token) {
  return jobAction(host + `/Api/v1/Jobs/${jobId}/Reopen?LighthouseFunction=JobReopen&userId=` + userId, token);
}

export function reject(jobId, text, host, userId = 'notPassed', token) {
  return jobAction(host + `/Api/v1/Jobs/${jobId}/Reject?LighthouseFunction=JobReject&userId=` + userId, token, {
    Text: text,
    Date: new Date().toISOString(),
  });
}

export function acknowledge(jobId, host, userId = 'notPassed', token) {
  return jobAction(host + `/Api/v1/Jobs/${jobId}/Acknowledge?LighthouseFunction=JobAcknowledge&userId=` + userId, token);
}

export async function complete(jobId, text, host, userId = 'notPassed', token) {
  try {
    await request(host + `/Api/v1/Jobs/${jobId}/Complete?LighthouseFunction=JobComplete&userId=` + userId, {
      method: 'POST',
      token,
      form: `Text=${encodeURIComponent(text)}&Date=${encodeURIComponent(new Date().toISOString())}`,
      responseType: 'none',
    });
    return true;
  } catch (_) {
    return false;
  }
}
